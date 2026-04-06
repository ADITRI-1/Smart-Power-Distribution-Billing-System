-- ==========================================
-- 1. WIPE EVERYTHING CLEAN
-- ==========================================
DROP TABLE IF EXISTS bill CASCADE;
DROP TABLE IF EXISTS meter_reading CASCADE;
DROP TABLE IF EXISTS area_monthly_supply CASCADE;
DROP TABLE IF EXISTS connection CASCADE;
DROP TABLE IF EXISTS tariff_slab CASCADE;
DROP TABLE IF EXISTS consumer CASCADE;
DROP TABLE IF EXISTS distribution_area CASCADE;
DROP TABLE IF EXISTS power_grid CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS consumer_users CASCADE;

DROP SEQUENCE IF EXISTS bill_id_seq CASCADE;
DROP SEQUENCE IF EXISTS reading_id_seq CASCADE;

CREATE SEQUENCE bill_id_seq START WITH 10000;
CREATE SEQUENCE reading_id_seq START WITH 1000;

-- ==========================================
-- 2. CREATE TABLES WITH STRICT CONSTRAINTS
-- ==========================================
CREATE TABLE admin_users (
    admin_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE consumer (
    consumer_id INT PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    permanent_address VARCHAR(200) NOT NULL,
    age INT CHECK (age >= 18)
);

CREATE TABLE consumer_users (
    user_id SERIAL PRIMARY KEY,
    consumer_id INT NOT NULL REFERENCES consumer(consumer_id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE power_grid (
    grid_id INT PRIMARY KEY,
    grid_name VARCHAR(80) NOT NULL,
    location VARCHAR(120) NOT NULL
);

CREATE TABLE distribution_area (
    area_id INT PRIMARY KEY,
    grid_id INT NOT NULL REFERENCES power_grid(grid_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    zone VARCHAR(80) NOT NULL,
    city VARCHAR(80) NOT NULL,
    poc VARCHAR(120)
);

CREATE TABLE connection (
    connection_id INT PRIMARY KEY,
    consumer_id INT NOT NULL REFERENCES consumer(consumer_id) ON UPDATE CASCADE ON DELETE CASCADE,
    area_id INT NOT NULL REFERENCES distribution_area(area_id) ON UPDATE CASCADE ON DELETE CASCADE,
    address VARCHAR(200) NOT NULL,
    connection_type VARCHAR(40) NOT NULL,
    load_assign VARCHAR(40),
    installation_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL
);

CREATE TABLE area_monthly_supply (
    supply_id INT PRIMARY KEY,
    area_id INT NOT NULL REFERENCES distribution_area(area_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    supply_month VARCHAR(15) NOT NULL,
    units_supplied NUMERIC(14, 3) NOT NULL CHECK (units_supplied >= 0),
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_supply_month UNIQUE (area_id, supply_month) -- Prevents duplicate grid supply logs
);

CREATE TABLE meter_reading (
    reading_id INT PRIMARY KEY,
    connection_id INT NOT NULL REFERENCES connection(connection_id) ON UPDATE CASCADE ON DELETE CASCADE,
    billing_month VARCHAR(15) NOT NULL,
    previous_reading NUMERIC(14, 3) NOT NULL CHECK (previous_reading >= 0),
    current_reading NUMERIC(14, 3) NOT NULL CHECK (current_reading >= previous_reading),
    units_consumed NUMERIC(14, 3) NOT NULL CHECK (units_consumed >= 0),
    captured_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_reading_month UNIQUE (connection_id, billing_month) -- THE ULTIMATE FIX: Prevents duplicate readings
);

CREATE TABLE tariff_slab (
    slab_id INT PRIMARY KEY,
    consumer_category VARCHAR(60) NOT NULL,
    unit_from NUMERIC(14, 3) NOT NULL CHECK (unit_from >= 0),
    unit_to NUMERIC(14, 3) NOT NULL CHECK (unit_to >= unit_from),
    rate_per_unit NUMERIC(10, 4) NOT NULL CHECK (rate_per_unit >= 0),
    fixed_charge NUMERIC(12, 2) NOT NULL CHECK (fixed_charge >= 0),
    effective_from DATE NOT NULL,
    effective_to DATE
);

CREATE TABLE bill (
    bill_id INT PRIMARY KEY,
    consumer_id INT NOT NULL REFERENCES consumer(consumer_id) ON UPDATE CASCADE ON DELETE CASCADE,
    connection_id INT NOT NULL REFERENCES connection(connection_id) ON UPDATE CASCADE ON DELETE CASCADE,
    slab_id INT NOT NULL REFERENCES tariff_slab(slab_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    billing_month VARCHAR(15) NOT NULL,
    units_consumed NUMERIC(14, 3) NOT NULL CHECK (units_consumed >= 0),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    payment_status VARCHAR(20) NOT NULL,
    generated_on DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    paid_on TIMESTAMP,
    CONSTRAINT unique_bill_month UNIQUE (connection_id, billing_month) -- THE ULTIMATE FIX: Prevents duplicate bills
);

-- ==========================================
-- 3. TELESCOPIC BILLING & CONTINUITY TRIGGERS
-- ==========================================
CREATE OR REPLACE FUNCTION fn_auto_mark_overdue() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.due_date < CURRENT_DATE AND NEW.payment_status = 'Unpaid' THEN NEW.payment_status := 'Overdue'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_auto_mark_overdue BEFORE INSERT OR UPDATE ON bill FOR EACH ROW EXECUTE FUNCTION fn_auto_mark_overdue();

CREATE OR REPLACE FUNCTION fn_validate_reading_continuity() RETURNS TRIGGER AS $$
DECLARE last_reading NUMERIC;
BEGIN
    SELECT current_reading INTO last_reading FROM meter_reading WHERE connection_id = NEW.connection_id ORDER BY reading_id DESC LIMIT 1;
    IF last_reading IS NOT NULL AND NEW.previous_reading <> last_reading THEN RAISE EXCEPTION 'Gap detected: prev (%) != current (%)', NEW.previous_reading, last_reading; END IF;
    IF NEW.current_reading < NEW.previous_reading THEN RAISE EXCEPTION 'Invalid reading: current < previous'; END IF;
    NEW.units_consumed := NEW.current_reading - NEW.previous_reading;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_validate_reading_continuity BEFORE INSERT ON meter_reading FOR EACH ROW EXECUTE FUNCTION fn_validate_reading_continuity();

CREATE OR REPLACE FUNCTION fn_generate_bill_after_reading() RETURNS TRIGGER AS $$
DECLARE
    v_consumer_id INT; v_conn_type VARCHAR(40); v_remaining NUMERIC; v_slab_units NUMERIC;
    v_bill_amount NUMERIC := 0; v_max_fixed NUMERIC := 0; v_highest_slab_id INT; slab_record RECORD;
BEGIN
    IF NEW.units_consumed = 0 AND NEW.current_reading = 0 THEN RETURN NEW; END IF;
    SELECT consumer_id, connection_type INTO v_consumer_id, v_conn_type FROM connection WHERE connection_id = NEW.connection_id;
    v_remaining := NEW.units_consumed;

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
    INSERT INTO bill (bill_id, consumer_id, connection_id, slab_id, billing_month, units_consumed, amount, payment_status, generated_on, due_date) 
    VALUES (nextval('bill_id_seq'), v_consumer_id, NEW.connection_id, v_highest_slab_id, NEW.billing_month, NEW.units_consumed, v_bill_amount, 'Unpaid', CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_generate_bill AFTER INSERT ON meter_reading FOR EACH ROW EXECUTE FUNCTION fn_generate_bill_after_reading();

-- ==========================================
-- 4. CLEAN, REALISTIC MOCK DATA (Including valid Analytics)
-- ==========================================
INSERT INTO power_grid VALUES (1, 'North City Grid', 'Delhi'), (2, 'South Metro Grid', 'Bengaluru');
INSERT INTO distribution_area VALUES (101, 1, 'Central Zone', 'Delhi', 'Rohit Verma'), (102, 1, 'West Zone', 'Delhi', 'Anjali Mehta'), (201, 2, 'IT Corridor', 'Bengaluru', 'Suresh Rao');
INSERT INTO consumer VALUES (1001, 'Aditri Jain', 'Connaught Place, Delhi', 22), (1002, 'Gaurav Jindal', 'Rajouri Garden, Delhi', 20), (1003, 'Kushagra', 'HSR Layout, Bengaluru', 25);
INSERT INTO connection VALUES (5001, 1001, 101, 'Connaught Place, Delhi', 'Domestic', '2kW', '2025-12-01', 'Active'), (5002, 1002, 102, 'Rajouri Garden, Delhi', 'Commercial', '5kW', '2025-12-01', 'Active'), (5003, 1003, 201, 'HSR Layout, Bengaluru', 'Domestic', '2kW', '2025-12-01', 'Active');
INSERT INTO tariff_slab VALUES (1, 'Domestic', 0, 100, 4.5, 50, '2024-04-01', NULL), (2, 'Domestic', 100, 999999, 6.0, 75, '2024-04-01', NULL), (3, 'Commercial', 0, 999999, 8.5, 200, '2024-04-01', NULL);

-- Analytics Supply Data (Scaled perfectly to match consumption + 10% loss)
INSERT INTO area_monthly_supply (supply_id, area_id, supply_month, units_supplied, recorded_at) VALUES
(9001, 101, '2025-12', 160, '2025-12-31 20:00:00'), (9002, 102, '2025-12', 450, '2025-12-31 20:00:00'), (9003, 201, '2025-12', 105, '2025-12-31 20:00:00'),
(9004, 101, '2026-01', 150, '2026-01-31 20:00:00'), (9005, 102, '2026-01', 520, '2026-01-31 20:00:00'), (9006, 201, '2026-01', 125, '2026-01-31 20:00:00'),
(9007, 101, '2026-02', 135, '2026-02-28 20:00:00'), (9008, 102, '2026-02', 470, '2026-02-28 20:00:00'), (9009, 201, '2026-02', 125, '2026-02-28 20:00:00'),
(9010, 101, '2026-03', 130, '2026-03-31 20:00:00'), (9011, 102, '2026-03', 480, '2026-03-31 20:00:00'), (9012, 201, '2026-03', 105, '2026-03-31 20:00:00');

-- Readings (Will generate 9 perfect bills automatically)
INSERT INTO meter_reading (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed) VALUES
(nextval('reading_id_seq'), 5001, '2025-12-Base', 0, 0, 0), (nextval('reading_id_seq'), 5002, '2025-12-Base', 0, 0, 0), (nextval('reading_id_seq'), 5003, '2025-12-Base', 0, 0, 0),
(nextval('reading_id_seq'), 5001, '2025-12', 0, 145, 0), (nextval('reading_id_seq'), 5002, '2025-12', 0, 420, 0), (nextval('reading_id_seq'), 5003, '2025-12', 0, 95, 0),
(nextval('reading_id_seq'), 5001, '2026-01', 145, 280, 0), (nextval('reading_id_seq'), 5002, '2026-01', 420, 910, 0), (nextval('reading_id_seq'), 5003, '2026-01', 95, 210, 0),
(nextval('reading_id_seq'), 5001, '2026-02', 280, 400, 0), (nextval('reading_id_seq'), 5002, '2026-02', 910, 1350, 0), (nextval('reading_id_seq'), 5003, '2026-02', 210, 320, 0),
(nextval('reading_id_seq'), 5001, '2026-03', 400, 520, 0), (nextval('reading_id_seq'), 5002, '2026-03', 1350, 1800, 0), (nextval('reading_id_seq'), 5003, '2026-03', 320, 415, 0);

UPDATE bill SET payment_status = 'Paid', paid_on = NOW() WHERE billing_month IN ('2025-12', '2026-01', '2026-02');