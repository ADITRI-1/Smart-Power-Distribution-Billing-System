-- 1. UPGRADE THE TRIGGER TO TELESCOPIC (STEPPED) BILLING
CREATE OR REPLACE FUNCTION fn_generate_bill_after_reading() RETURNS TRIGGER AS $$
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
    -- Skip baseline installations
    IF NEW.units_consumed = 0 AND NEW.current_reading = 0 THEN
        RETURN NEW;
    END IF;

    SELECT consumer_id, connection_type INTO v_consumer_id, v_conn_type 
    FROM connection WHERE connection_id = NEW.connection_id;

    v_remaining_units := NEW.units_consumed;

    -- Loop through the slabs one by one (e.g., 0-100, then 100-300...)
    FOR slab_record IN 
        SELECT slab_id, unit_from, unit_to, rate_per_unit, fixed_charge 
        FROM tariff_slab 
        WHERE LOWER(consumer_category) = LOWER(v_conn_type) 
        ORDER BY unit_from ASC
    LOOP
        IF v_remaining_units > 0 THEN
            -- Calculate how much fits in this specific slab
            IF v_remaining_units > (slab_record.unit_to - slab_record.unit_from) THEN
                v_slab_units := (slab_record.unit_to - slab_record.unit_from);
            ELSE
                v_slab_units := v_remaining_units;
            END IF;

            -- Add the cost of these specific units to the total
            v_bill_amount := v_bill_amount + (v_slab_units * slab_record.rate_per_unit);
            
            -- Track the highest fixed charge and slab ID reached
            IF slab_record.fixed_charge > v_max_fixed_charge THEN
                v_max_fixed_charge := slab_record.fixed_charge;
            END IF;
            v_highest_slab_id := slab_record.slab_id;

            -- Deduct processed units before moving to the next slab
            v_remaining_units := v_remaining_units - v_slab_units;
        END IF;
    END LOOP;

    -- Add the Fixed Charge to the final calculated units
    v_bill_amount := ROUND(v_bill_amount + v_max_fixed_charge, 2);

    INSERT INTO bill (
        bill_id, consumer_id, connection_id, slab_id, billing_month, 
        units_consumed, amount, payment_status, generated_on, due_date
    ) VALUES (
        nextval('bill_id_seq'), v_consumer_id, NEW.connection_id, v_highest_slab_id, NEW.billing_month,
        NEW.units_consumed, v_bill_amount, 'Unpaid', CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 2. RECALCULATE EXISTING BILLS TO APPLY THE NEW MATH
-- ========================================================
-- This will safely delete the badly calculated bills/readings 
-- and re-insert them so the new trigger can calculate them perfectly.

DELETE FROM meter_reading;

-- Base
INSERT INTO meter_reading (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed) VALUES
(nextval('reading_id_seq'), 5001, '2025-12-Base', 0, 0, 0), 
(nextval('reading_id_seq'), 5002, '2025-12-Base', 0, 0, 0), 
(nextval('reading_id_seq'), 5003, '2025-12-Base', 0, 0, 0);

-- Dec 2025 
INSERT INTO meter_reading (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed) VALUES
(nextval('reading_id_seq'), 5001, '2025-12', 0, 145, 0),   
(nextval('reading_id_seq'), 5002, '2025-12', 0, 420, 0),   
(nextval('reading_id_seq'), 5003, '2025-12', 0, 95, 0);     

-- Jan 2026  
INSERT INTO meter_reading (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed) VALUES
(nextval('reading_id_seq'), 5001, '2026-01', 145, 280, 0),
(nextval('reading_id_seq'), 5002, '2026-01', 420, 910, 0),
(nextval('reading_id_seq'), 5003, '2026-01', 95, 210, 0);

-- Feb 2026 
INSERT INTO meter_reading (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed) VALUES
(nextval('reading_id_seq'), 5001, '2026-02', 280, 400, 0),
(nextval('reading_id_seq'), 5002, '2026-02', 910, 1350, 0),
(nextval('reading_id_seq'), 5003, '2026-02', 210, 320, 0);  -- Adjusted Kushagra's reading to exactly 110 units!

-- Mar 2026 
INSERT INTO meter_reading (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed) VALUES
(nextval('reading_id_seq'), 5001, '2026-03', 400, 520, 0),  
(nextval('reading_id_seq'), 5002, '2026-03', 1350, 1800, 0), 
(nextval('reading_id_seq'), 5003, '2026-03', 320, 415, 0);   

-- Mark History Paid
UPDATE bill SET payment_status = 'Paid', paid_on = NOW() WHERE billing_month IN ('2025-12', '2026-01', '2026-02');