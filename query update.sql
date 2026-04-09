-- Add a payment method column to track Cash, UPI, Card, etc.
ALTER TABLE bill ADD COLUMN payment_method VARCHAR(50);



-- ==============================================================================
-- 1. REWRITE THE BILL GENERATOR TRIGGER TO USE FIXED DUE DATES (15TH OF NEXT MONTH)
-- ==============================================================================
CREATE OR REPLACE FUNCTION fn_generate_bill_after_reading() RETURNS TRIGGER AS $$
DECLARE
    v_consumer_id INT; v_conn_type VARCHAR(40); v_remaining NUMERIC; v_slab_units NUMERIC;
    v_bill_amount NUMERIC := 0; v_max_fixed NUMERIC := 0; v_highest_slab_id INT; slab_record RECORD;
    v_due_date DATE; -- Variable to hold our new perfectly calculated date
BEGIN
    -- Ignore the base installation readings (they don't generate bills)
    IF NEW.units_consumed = 0 AND NEW.current_reading = 0 THEN RETURN NEW; END IF;
    
    SELECT consumer_id, connection_type INTO v_consumer_id, v_conn_type FROM connection WHERE connection_id = NEW.connection_id;
    v_remaining := NEW.units_consumed;

    -- Tariff Calculation Engine
    FOR slab_record IN SELECT slab_id, unit_from, unit_to, rate_per_unit, fixed_charge FROM tariff_slab WHERE LOWER(consumer_category) = LOWER(v_conn_type) ORDER BY unit_from ASC LOOP
        IF v_remaining > 0 THEN
            IF v_remaining > (slab_record.unit_to - slab_record.unit_from) THEN v_slab_units := (slab_record.unit_to - slab_record.unit_from); ELSE v_slab_units := v_remaining; END IF;
            v_bill_amount := v_bill_amount + (v_slab_units * slab_record.rate_per_unit);
            IF slab_record.fixed_charge > v_max_fixed THEN v_max_fixed := slab_record.fixed_charge; END IF;
            v_highest_slab_id := slab_record.slab_id;
            v_remaining := v_remaining - v_slab_units;
        END IF;
    END LOOP;
    
    v_bill_amount := ROUND(v_bill_amount + v_max_fixed, 2);
    
    -- THE FIX: Convert 'YYYY-MM' to the 1st of that month, add 1 month, then add 14 days to hit the 15th
    -- Example: '2026-03' -> '2026-03-01' -> '2026-04-01' -> '2026-04-15'
    v_due_date := (TO_DATE(NEW.billing_month || '-01', 'YYYY-MM-DD') + INTERVAL '1 month' + INTERVAL '14 days')::DATE;
    
    -- Insert the new bill with our meticulously calculated due date
    INSERT INTO bill (bill_id, consumer_id, connection_id, slab_id, billing_month, units_consumed, amount, payment_status, generated_on, due_date) 
    VALUES (nextval('bill_id_seq'), v_consumer_id, NEW.connection_id, v_highest_slab_id, NEW.billing_month, NEW.units_consumed, v_bill_amount, 'Unpaid', CURRENT_DATE, v_due_date);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ==============================================================================
-- 2. RETROACTIVELY FIX ALL EXISTING BILLS IN THE DATABASE
-- ==============================================================================
-- This instantly patches any bills you generated yesterday or earlier today
UPDATE bill 
SET due_date = (TO_DATE(billing_month || '-01', 'YYYY-MM-DD') + INTERVAL '1 month' + INTERVAL '14 days')::DATE
WHERE billing_month ~ '^\d{4}-\d{2}$'; -- Safety check: Only apply to valid 'YYYY-MM' strings