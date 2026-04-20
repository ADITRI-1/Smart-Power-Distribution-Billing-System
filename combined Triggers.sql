-- =========================================================================
-- 1. DATA INTEGRITY: trg_validate_reading_continuity
-- Purpose: Ensures meter readings are strictly consecutive and chronological.
-- =========================================================================

CREATE OR REPLACE FUNCTION fn_validate_reading_continuity()
RETURNS TRIGGER AS $$
DECLARE
    last_reading NUMERIC;
BEGIN
    -- Fetch the absolute latest reading recorded for this connection
    SELECT current_reading INTO last_reading
    FROM meter_reading
    WHERE connection_id = NEW.connection_id
    ORDER BY TO_DATE(billing_month, 'YYYY-MM') DESC
    LIMIT 1;

    -- RULE 1: Previous reading must match the database's last known current reading
    IF last_reading IS NOT NULL AND NEW.previous_reading <> last_reading THEN
        RAISE EXCEPTION 'Gap detected: previous_reading (%) must match last current_reading (%)', 
        NEW.previous_reading, last_reading;
    END IF;

    -- RULE 2: Current reading cannot be less than previous reading (No going backwards)
    IF NEW.current_reading < NEW.previous_reading THEN
        RAISE EXCEPTION 'Invalid reading: current (%) cannot be less than previous (%)', 
        NEW.current_reading, NEW.previous_reading;
    END IF;

    -- AUTO-CALCULATION: Derive units before the row is finalized
    NEW.units_consumed := NEW.current_reading - NEW.previous_reading;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_reading_continuity
BEFORE INSERT ON meter_reading
FOR EACH ROW EXECUTE FUNCTION fn_validate_reading_continuity();


-- =========================================================================
-- 2. BUSINESS LOGIC: trg_generate_bill (Telescopic Billing)
-- Purpose: Automatically calculates and generates a bill using stepped slabs.
-- =========================================================================

CREATE OR REPLACE FUNCTION fn_generate_bill_after_reading() 
RETURNS TRIGGER AS $$
DECLARE
    v_consumer_id INT;
    v_conn_type VARCHAR(40);
    v_remaining_units NUMERIC;
    v_slab_units NUMERIC;
    v_bill_amount NUMERIC := 0;
    v_max_fixed_charge NUMERIC := 0;
    v_highest_slab_id INT;
    slab_record RECORD;
BEGIN
    -- Ignore baseline/setup readings (0 units)
    IF NEW.units_consumed = 0 AND NEW.current_reading = 0 THEN RETURN NEW; END IF;

    -- Get consumer context
    SELECT consumer_id, connection_type INTO v_consumer_id, v_conn_type 
    FROM connection WHERE connection_id = NEW.connection_id;

    v_remaining_units := NEW.units_consumed;

    -- TELESCOPIC CALCULATION: Step through slabs (0-100, 100-300, etc.)
    FOR slab_record IN 
        SELECT slab_id, unit_from, unit_to, rate_per_unit, fixed_charge 
        FROM tariff_slab 
        WHERE LOWER(consumer_category) = LOWER(v_conn_type) 
        ORDER BY unit_from ASC
    LOOP
        IF v_remaining_units > 0 THEN
            v_slab_units := LEAST(v_remaining_units, (slab_record.unit_to - slab_record.unit_from));
            v_bill_amount := v_bill_amount + (v_slab_units * slab_record.rate_per_unit);
            
            -- Apply the highest reached slab's fixed charge
            IF slab_record.fixed_charge > v_max_fixed_charge THEN
                v_max_fixed_charge := slab_record.fixed_charge;
            END IF;
            v_highest_slab_id := slab_record.slab_id;
            v_remaining_units := v_remaining_units - v_slab_units;
        END IF;
    END LOOP;

    -- AUTOMATED INSERT: Generate the Bill row
    INSERT INTO bill (
        bill_id, consumer_id, connection_id, slab_id, billing_month, 
        units_consumed, amount, payment_status, generated_on, due_date
    ) VALUES (
        nextval('bill_id_seq'), v_consumer_id, NEW.connection_id, v_highest_slab_id, 
        NEW.billing_month, NEW.units_consumed, ROUND(v_bill_amount + v_max_fixed_charge, 2), 
        'Unpaid', CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_bill
AFTER INSERT ON meter_reading
FOR EACH ROW EXECUTE FUNCTION fn_generate_bill_after_reading();


-- =========================================================================
-- 3. STATE MANAGEMENT: trg_auto_mark_overdue
-- Purpose: System-wide "self-awareness" of payment deadlines.
-- =========================================================================

CREATE OR REPLACE FUNCTION fn_auto_mark_overdue()
RETURNS TRIGGER AS $$
BEGIN
    -- Automatically flip status to 'Overdue' if date passed and still 'Unpaid'
    IF NEW.due_date < CURRENT_DATE AND NEW.payment_status = 'Unpaid' THEN
        NEW.payment_status := 'Overdue';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_mark_overdue
BEFORE INSERT OR UPDATE ON bill
FOR EACH ROW EXECUTE FUNCTION fn_auto_mark_overdue();