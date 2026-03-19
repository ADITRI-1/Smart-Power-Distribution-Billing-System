-- Trigger 1: Auto mark overdue bills
CREATE OR REPLACE FUNCTION fn_auto_mark_overdue()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.due_date < CURRENT_DATE
       AND NEW.payment_status = 'Unpaid'
    THEN
        NEW.payment_status := 'Overdue';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_auto_mark_overdue
BEFORE INSERT OR UPDATE ON bill
FOR EACH ROW
EXECUTE FUNCTION fn_auto_mark_overdue();


-- Test Trigger 1
INSERT INTO bill (
    bill_id, consumer_id, connection_id, slab_id,
    billing_month, units_consumed, amount,
    payment_status, generated_on, due_date
)
VALUES (
    9999, 1001, 5001, 1,
    '2024-10', 80, 410.00,
    'Unpaid',
    '2024-10-01',
    '2024-10-15'
);

SELECT bill_id, payment_status, due_date
FROM bill
WHERE bill_id = 9999;


INSERT INTO bill (
    bill_id, consumer_id, connection_id, slab_id,
    billing_month, units_consumed, amount,
    payment_status, generated_on, due_date
)
VALUES (
    9998, 1001, 5001, 1,
    '2026-06', 80, 410.00,
    'Unpaid',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days'
);

SELECT bill_id, payment_status, due_date
FROM bill
WHERE bill_id = 9998;

DELETE FROM bill WHERE bill_id IN (9999, 9998);


DELETE FROM meter_reading WHERE reading_id IN (10,11,12);

-- Trigger 2: Validate meter reading continuity
CREATE OR REPLACE FUNCTION fn_validate_reading_continuity()
RETURNS TRIGGER AS $$
DECLARE
    last_reading NUMERIC;
BEGIN
    -- get latest reading for same connection
    SELECT current_reading
    INTO last_reading
    FROM meter_reading
    WHERE connection_id = NEW.connection_id
    ORDER BY TO_DATE(billing_month, 'YYYY-MM') DESC
    LIMIT 1;

    -- previous reading must match last current reading
    IF last_reading IS NOT NULL THEN
        IF NEW.previous_reading <> last_reading THEN
            RAISE EXCEPTION
                'Reading gap detected for connection %: previous_reading (%) does not match last current_reading (%)',
                NEW.connection_id,
                NEW.previous_reading,
                last_reading;
        END IF;
    END IF;

    -- current reading cannot be smaller
    IF NEW.current_reading < NEW.previous_reading THEN
        RAISE EXCEPTION
            'Invalid reading: current_reading (%) cannot be less than previous_reading (%)',
            NEW.current_reading,
            NEW.previous_reading;
    END IF;

    -- auto calculate units
    NEW.units_consumed := NEW.current_reading - NEW.previous_reading;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_validate_reading_continuity ON meter_reading;

CREATE TRIGGER trg_validate_reading_continuity
BEFORE INSERT ON meter_reading
FOR EACH ROW
EXECUTE FUNCTION fn_validate_reading_continuity();


-- Test Trigger 2

-- correct insert
INSERT INTO meter_reading (
    reading_id,
    connection_id,
    billing_month,
    previous_reading,
    current_reading,
    units_consumed
)
VALUES (
    10,
    5001,
    '2025-12',
    1200,
    1415,
    0
);

SELECT reading_id, billing_month, previous_reading, current_reading, units_consumed
FROM meter_reading
WHERE reading_id = 10;


-- wrong continuity
INSERT INTO meter_reading (
    reading_id,
    connection_id,
    billing_month,
    previous_reading,
    current_reading,
    units_consumed
)
VALUES (
    11,
    5001,
    '2026-01',
    999,
    1500,
    0
);


-- negative reading
INSERT INTO meter_reading (
    reading_id,
    connection_id,
    billing_month,
    previous_reading,
    current_reading,
    units_consumed
)
VALUES (
    12,
    5001,
    '2026-02',
    1415,
    1300,
    0
);

DELETE FROM meter_reading WHERE reading_id = 10;