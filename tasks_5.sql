
-- =============================================================
-- TRIGGER 1 : trg_auto_mark_overdue
-- TABLE     : bill
-- FIRES     : BEFORE INSERT OR UPDATE
-- PURPOSE   : If a bill is inserted or updated with
--             payment_status = 'Unpaid' AND its due_date has
--             already passed, the trigger automatically changes
--             the status to 'Overdue' before saving the row.
--             This removes the need for any manual cron job or
--             backend scan to detect overdue bills.
-- =============================================================
-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION fn_auto_mark_overdue()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the due date has passed AND the bill is still unpaid
    -- Only then do we change the status — paid bills are never touched
    IF NEW.due_date < CURRENT_DATE
       AND NEW.payment_status = 'Unpaid'
    THEN
        NEW.payment_status := 'Overdue';
    END IF;

    -- Return the (possibly modified) row so PostgreSQL can save it
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Attach the function to the bill table
-- BEFORE is used so we can modify NEW.payment_status before it is written to disk
CREATE OR REPLACE TRIGGER trg_auto_mark_overdue
    BEFORE INSERT OR UPDATE ON bill
    FOR EACH ROW
    EXECUTE FUNCTION fn_auto_mark_overdue();


-- ── TEST CASES FOR TRIGGER 1 ──────────────────────────────────

-- Test A: Insert a bill with a past due_date and status = 'Unpaid'
-- Expected result: trigger auto-changes payment_status to 'Overdue'
INSERT INTO bill (
    bill_id, consumer_id, connection_id, slab_id,
    billing_month, units_consumed, amount,
    payment_status, generated_on, due_date
) VALUES (
    9999, 1001, 5001, 1,
    '2024-10', 80, 410.00,
    'Unpaid',          -- inserted as Unpaid ...
    '2024-10-01',
    '2024-10-15'       -- ... but due_date is in the past
);

-- Verify: should show payment_status = 'Overdue'
SELECT bill_id, payment_status, due_date
FROM   bill
WHERE  bill_id = 9999;
-- Expected: payment_status = 'Overdue'  

-- Test B: Insert a bill with a future due_date — trigger should NOT change it
INSERT INTO bill (
    bill_id, consumer_id, connection_id, slab_id,
    billing_month, units_consumed, amount,
    payment_status, generated_on, due_date
) VALUES (
    9998, 1001, 5001, 1,
    '2026-06', 80, 410.00,
    'Unpaid',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days'  -- future due_date
);

-- Verify: should still show payment_status = 'Unpaid'
SELECT bill_id, payment_status, due_date
FROM   bill
WHERE  bill_id = 9998;
-- Expected: payment_status = 'Unpaid'  

-- Cleanup test rows
DELETE FROM bill WHERE bill_id IN (9999, 9998);




-- =============================================================
-- TRIGGER 2 : trg_validate_reading_continuity
-- TABLE     : meter_reading
-- FIRES     : BEFORE INSERT
-- PURPOSE   : An electricity meter is cumulative — it never
--             resets. So if last month's reading ended at 1200,
--             this month's previous_reading MUST also be 1200.
--             This trigger fetches the most recent
--             current_reading for the same connection and raises
--             an error if the new previous_reading doesn't match.
--             It also auto-computes units_consumed from the two
--             readings to eliminate manual calculation errors.
-- =============================================================

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION fn_validate_reading_continuity()
RETURNS TRIGGER AS $$
DECLARE
    last_reading NUMERIC;  -- will hold the last recorded current_reading
BEGIN
    -- Fetch the most recent current_reading for this connection
    SELECT current_reading
    INTO   last_reading
    FROM   meter_reading
    WHERE  connection_id = NEW.connection_id
    ORDER  BY billing_month DESC
    LIMIT  1;

    -- If a previous reading exists, validate continuity
    -- (If this is the very first reading for this connection, skip the check)
    IF last_reading IS NOT NULL THEN
        IF NEW.previous_reading <> last_reading THEN
            -- Abort the INSERT and explain the mismatch clearly
            RAISE EXCEPTION
                'Reading gap detected for connection %: '
                'previous_reading (%) does not match '
                'last recorded current_reading (%).',
                NEW.connection_id,
                NEW.previous_reading,
                last_reading;
        END IF;
    END IF;

    -- Auto-compute units_consumed so manual entry errors are impossible
    NEW.units_consumed := NEW.current_reading - NEW.previous_reading;

    -- Return the corrected row for PostgreSQL to save
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Step 2: Attach the function to the meter_reading table
CREATE OR REPLACE TRIGGER trg_validate_reading_continuity
    BEFORE INSERT ON meter_reading
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_reading_continuity();


-- ── TEST CASES FOR TRIGGER 2 ──────────────────────────────────
-- Assumption: connection 5001 has an existing reading with
--             billing_month = '2025-11' and current_reading = 1200

-- Test A: CORRECT — previous_reading matches last current_reading
-- Expected result: INSERT succeeds; trigger auto-sets units_consumed = 215
INSERT INTO meter_reading (
    reading_id, connection_id, billing_month,
    previous_reading, current_reading, units_consumed
) VALUES (
    10, 5001, '2025-12',
    1200,   -- matches last current_reading 
    1415,
    0       -- trigger will overwrite this with 215
);

-- Verify: units_consumed should be 215 (not 0)
SELECT reading_id, billing_month, previous_reading,
       current_reading, units_consumed
FROM   meter_reading
WHERE  reading_id = 10;
-- Expected: units_consumed = 215  

-- Test B: WRONG — previous_reading does NOT match last current_reading
-- Expected result: INSERT is aborted with an error message
INSERT INTO meter_reading (
    reading_id, connection_id, billing_month,
    previous_reading, current_reading, units_consumed
) VALUES (
    11, 5001, '2026-01',
    999,    -- WRONG: last current_reading was 1415, not 999
    1500,
    0
);
-- Expected error:
-- "Reading gap detected for connection 5001:
--  previous_reading (999) does not match
--  last recorded current_reading (1415)."  

-- Cleanup test row (only Test A would have been inserted)
DELETE FROM meter_reading WHERE reading_id = 10;