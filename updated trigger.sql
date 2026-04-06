-- 1. Create sequences to safely auto-generate IDs without clashing with old data
CREATE SEQUENCE IF NOT EXISTS bill_id_seq START WITH 10000;
CREATE SEQUENCE IF NOT EXISTS reading_id_seq START WITH 1000;

-- 2. The Auto-Bill Generator Function
CREATE OR REPLACE FUNCTION fn_generate_bill_after_reading() 
RETURNS TRIGGER AS $$
DECLARE
    v_consumer_id INT;
    v_conn_type VARCHAR(40);
    v_slab_id INT;
    v_rate NUMERIC;
    v_fixed NUMERIC;
    v_bill_amount NUMERIC;
    v_due_date DATE;
BEGIN
    -- Skip billing if this is a baseline installation reading (0 units, 0 current)
    IF NEW.units_consumed = 0 AND NEW.current_reading = 0 THEN
        RETURN NEW;
    END IF;

    -- Fetch connection and consumer details
    SELECT consumer_id, connection_type INTO v_consumer_id, v_conn_type
    FROM connection WHERE connection_id = NEW.connection_id;

    -- Dynamically find the correct tariff slab based on type and units consumed
    SELECT slab_id, rate_per_unit, fixed_charge INTO v_slab_id, v_rate, v_fixed
    FROM tariff_slab
    WHERE LOWER(consumer_category) = LOWER(v_conn_type)
      AND NEW.units_consumed BETWEEN unit_from AND unit_to
      AND effective_to IS NULL
    LIMIT 1;

    -- Failsafe: If no slab exists, block the reading
    IF v_slab_id IS NULL THEN
        RAISE EXCEPTION 'No applicable tariff slab found for type % and units %', v_conn_type, NEW.units_consumed;
    END IF;

    -- Calculate exact bill amount
    v_bill_amount := ROUND((NEW.units_consumed * v_rate) + v_fixed, 2);
    v_due_date := CURRENT_DATE + INTERVAL '15 days';

    -- Insert the generated bill directly into the DB
    INSERT INTO bill (
        bill_id, consumer_id, connection_id, slab_id, billing_month,
        units_consumed, amount, payment_status, generated_on, due_date
    ) VALUES (
        nextval('bill_id_seq'), v_consumer_id, NEW.connection_id, v_slab_id, NEW.billing_month,
        NEW.units_consumed, v_bill_amount, 'Unpaid', CURRENT_DATE, v_due_date
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach the Trigger
DROP TRIGGER IF EXISTS trg_generate_bill ON meter_reading;
CREATE TRIGGER trg_generate_bill
AFTER INSERT ON meter_reading
FOR EACH ROW EXECUTE FUNCTION fn_generate_bill_after_reading();