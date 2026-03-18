
-- =============================================================
-- HOW TO RUN:
--   Open pgAdmin → Query Tool → paste this entire file → Run (F5)
--   OR run via psql:  \i path/to/smart_power_complete.sql
-- =============================================================

-- =============================================================
-- PART 1 : SCHEMA — DROP, CREATE & INSERT
-- =============================================================

-- ── 1.1 Drop existing tables (clean re-run) ──────────────────
DROP TABLE IF EXISTS bill CASCADE;
DROP TABLE IF EXISTS meter_reading CASCADE;
DROP TABLE IF EXISTS area_monthly_supply CASCADE;
DROP TABLE IF EXISTS connection CASCADE;
DROP TABLE IF EXISTS tariff_slab CASCADE;
DROP TABLE IF EXISTS consumer CASCADE;
DROP TABLE IF EXISTS distribution_area CASCADE;
DROP TABLE IF EXISTS power_grid CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS consumer_users CASCADE;

-- ── 1.2 Create tables ────────────────────────────────────────

CREATE TABLE power_grid (
  grid_id    INT PRIMARY KEY,
  grid_name  VARCHAR(80) NOT NULL,
  location   VARCHAR(120) NOT NULL
);

CREATE UNIQUE INDEX uq_power_grid_name_ci
ON power_grid (LOWER(grid_name));


CREATE TABLE distribution_area (
  area_id  INT PRIMARY KEY,
  grid_id  INT NOT NULL REFERENCES power_grid(grid_id)
           ON UPDATE CASCADE ON DELETE RESTRICT,
  zone     VARCHAR(80) NOT NULL,
  city     VARCHAR(80) NOT NULL,
  poc      VARCHAR(120)
);

CREATE UNIQUE INDEX uq_zone_city_ci
ON distribution_area (LOWER(city), LOWER(zone));


CREATE TABLE consumer (
  consumer_id        INT PRIMARY KEY,
  full_name          VARCHAR(120) NOT NULL,
  permanent_address  VARCHAR(200) NOT NULL,
  age                INT CHECK (age >= 18)
);


CREATE TABLE connection (
  connection_id     INT PRIMARY KEY,
  consumer_id       INT NOT NULL REFERENCES consumer(consumer_id)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
  area_id           INT NOT NULL REFERENCES distribution_area(area_id)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
  address           VARCHAR(200) NOT NULL,
  connection_type   VARCHAR(40) NOT NULL,
  load_assign       VARCHAR(40),
  installation_date DATE NOT NULL,
  status            VARCHAR(30) NOT NULL
);

CREATE UNIQUE INDEX uq_connection_address_ci
ON connection (area_id, LOWER(address));


CREATE TABLE area_monthly_supply (
  supply_id      INT PRIMARY KEY,
  area_id        INT NOT NULL REFERENCES distribution_area(area_id)
                 ON UPDATE CASCADE ON DELETE RESTRICT,
  supply_month   VARCHAR(15) NOT NULL,
  units_supplied NUMERIC(14, 3) NOT NULL CHECK (units_supplied >= 0),
  recorded_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_supply_area_month_ci
ON area_monthly_supply (area_id, LOWER(supply_month));


CREATE TABLE meter_reading (
  reading_id        INT PRIMARY KEY,
  connection_id     INT NOT NULL REFERENCES connection(connection_id)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
  billing_month     VARCHAR(15) NOT NULL,
  previous_reading  NUMERIC(14, 3) NOT NULL CHECK (previous_reading >= 0),
  current_reading   NUMERIC(14, 3) NOT NULL CHECK (current_reading >= previous_reading),
  units_consumed    NUMERIC(14, 3) NOT NULL CHECK (units_consumed >= 0),
  captured_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_reading_conn_month_ci
ON meter_reading (connection_id, LOWER(billing_month));


CREATE TABLE tariff_slab (
  slab_id           INT PRIMARY KEY,
  consumer_category VARCHAR(60) NOT NULL,
  unit_from         NUMERIC(14, 3) NOT NULL CHECK (unit_from >= 0),
  unit_to           NUMERIC(14, 3) NOT NULL CHECK (unit_to >= unit_from),
  rate_per_unit     NUMERIC(10, 4) NOT NULL CHECK (rate_per_unit >= 0),
  fixed_charge      NUMERIC(12, 2) NOT NULL CHECK (fixed_charge >= 0),
  effective_from    DATE NOT NULL,
  effective_to      DATE,
  CONSTRAINT chk_effective_range CHECK
     (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX uq_tariff_category_ci
ON tariff_slab (LOWER(consumer_category), unit_from, unit_to);


CREATE TABLE bill (
  bill_id        INT PRIMARY KEY,
  consumer_id    INT NOT NULL REFERENCES consumer(consumer_id)
                 ON UPDATE CASCADE ON DELETE RESTRICT,
  connection_id  INT NOT NULL REFERENCES connection(connection_id)
                 ON UPDATE CASCADE ON DELETE RESTRICT,
  slab_id        INT NOT NULL REFERENCES tariff_slab(slab_id)
                 ON UPDATE CASCADE ON DELETE RESTRICT,
  billing_month  VARCHAR(15) NOT NULL,
  units_consumed NUMERIC(14, 3) NOT NULL CHECK (units_consumed >= 0),
  amount         NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  payment_status VARCHAR(20) NOT NULL,
  generated_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date       DATE NOT NULL,
  paid_on        TIMESTAMP,
  CONSTRAINT chk_bill_dates CHECK (due_date >= generated_on),
  CONSTRAINT chk_paid_on    CHECK (paid_on IS NULL OR paid_on::date >= generated_on)
);

CREATE UNIQUE INDEX uq_bill_conn_month_ci
ON bill (connection_id, LOWER(billing_month));

-- Auth tables
CREATE TABLE admin_users (
    admin_id      SERIAL PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE consumer_users (
    user_id       SERIAL PRIMARY KEY,
    consumer_id   INT NOT NULL REFERENCES consumer(consumer_id) ON DELETE CASCADE,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

-- Performance indexes
CREATE INDEX idx_distribution_area_grid ON distribution_area(grid_id);
CREATE INDEX idx_connection_consumer    ON connection(consumer_id);
CREATE INDEX idx_connection_area        ON connection(area_id);


-- ── 1.3 Insert dummy data ─────────────────────────────────────

INSERT INTO power_grid VALUES
(1, 'North City Grid',  'Delhi'),
(2, 'South Metro Grid', 'Bengaluru');

INSERT INTO distribution_area VALUES
(101, 1, 'Central Zone', 'Delhi',     'Rohit Verma'),
(102, 1, 'West Zone',    'Delhi',     'Anjali Mehta'),
(201, 2, 'IT Corridor',  'Bengaluru', 'Suresh Rao'),
(103, 1, 'Zone D',       'Ogdenville','Alice Brown');

INSERT INTO consumer VALUES
(1001, 'Aditri Jain',   'Connaught Place, Delhi',  22),
(1002, 'Gaurav Jindal', 'Rajouri Garden, Delhi',    29),
(1003, 'Kushagra',      'HSR Layout, Bengaluru',    25),
(1004, 'Parv Jain',     'Indiranagar, Bengaluru',   23);

INSERT INTO connection VALUES
(5001, 1001, 101, 'Connaught Place, Delhi', 'Domestic',   '2kW', '2024-04-10', 'Active'),
(5002, 1002, 102, 'Rajouri Garden, Delhi',  'Commercial', '5kW', '2024-06-15', 'Active'),
(5003, 1003, 201, 'HSR Layout, Bengaluru',  'Domestic',   '3kW', '2024-05-05', 'Active'),
(5004, 1004, 201, 'Indiranagar, Bengaluru', 'Domestic',   '2kW', '2024-07-01', 'Active');

INSERT INTO area_monthly_supply VALUES
(9001, 101, '2025-11', 120000, '2025-11-30 20:00:00'),
(9002, 102, '2025-11',  95000, '2025-11-30 20:00:00'),
(9003, 201, '2025-11', 110500, '2025-11-30 20:00:00');

INSERT INTO meter_reading
    (reading_id, connection_id, billing_month, previous_reading, current_reading, units_consumed)
VALUES
(1, 5001, '2025-11', 1000, 1200, 200),
(2, 5002, '2025-11', 5000, 7230, 2230),
(3, 5003, '2025-11', 2000, 2200, 200);

INSERT INTO tariff_slab VALUES
(1, 'Domestic',   0,      100,    4.5, 50,  '2024-04-01', NULL),
(2, 'Domestic',   100,    300,    6.0, 75,  '2024-04-01', NULL),
(3, 'Commercial', 0,      999999, 8.5, 200, '2024-04-01', NULL);

INSERT INTO bill VALUES
(8001, 1001, 5001, 1, '2025-11', 65,  342.5, 'Paid', '2025-12-01', '2025-12-15', '2025-12-10'),
(9000, 1002, 5002, 3, '2025-11', 80,  400.0, 'Paid', '2025-12-01', '2025-12-15', NULL);


-- =============================================================
-- PART 2 : SQL QUERIES (Task 4 — 25 Queries)
-- =============================================================

-- Query 1: List all active electricity connections
SELECT connection_id,
       consumer_id,
       area_id,
       connection_type,
       load_assign,
       TO_CHAR(installation_date, 'YYYY-MM-DD') AS install_date,
       status
FROM   connection
WHERE  status = 'Active'
ORDER  BY connection_id;


-- Query 2: Get all unpaid or overdue bills
SELECT bill_id,
       consumer_id,
       connection_id,
       billing_month,
       units_consumed,
       amount,
       payment_status,
       TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date
FROM   bill
WHERE  payment_status = 'Unpaid'
    OR payment_status = 'Overdue'
ORDER  BY due_date ASC;


-- Query 3: Find consumers whose age lies between 18 and 25
SELECT consumer_id,
       full_name,
       permanent_address,
       age
FROM   consumer
WHERE  age BETWEEN 18 AND 25
ORDER  BY age ASC;


-- Query 4: Display only grid names and locations
SELECT grid_id,
       grid_name,
       location
FROM   power_grid
ORDER  BY grid_id;


-- Query 5: Show full consumer profile along with connection, grid, and zone details
SELECT c.consumer_id,
       c.full_name,
       c.permanent_address,
       c.age,
       conn.connection_id,
       conn.connection_type,
       conn.load_assign,
       conn.status AS connection_status,
       da.zone,
       da.city,
       pg.grid_name
FROM   consumer c
JOIN   connection conn        ON c.consumer_id  = conn.consumer_id
JOIN   distribution_area da   ON conn.area_id   = da.area_id
JOIN   power_grid pg          ON da.grid_id     = pg.grid_id
WHERE  c.consumer_id = 1001;


-- Query 6: List all distribution areas with their parent grid name
SELECT da.area_id,
       da.zone,
       da.city,
       da.poc,
       pg.grid_name
FROM   distribution_area da
JOIN   power_grid pg ON da.grid_id = pg.grid_id
ORDER  BY da.area_id;


-- Query 7: Show meter readings with consumer name and connection details
SELECT mr.reading_id,
       mr.connection_id,
       c.full_name AS consumer_name,
       mr.billing_month,
       mr.previous_reading,
       mr.current_reading,
       mr.units_consumed
FROM   meter_reading mr
JOIN   connection conn ON mr.connection_id = conn.connection_id
JOIN   consumer c      ON conn.consumer_id = c.consumer_id
ORDER  BY mr.reading_id;


-- Query 8: Display bills with consumer name and applicable tariff rate
SELECT b.bill_id,
       c.full_name AS consumer_name,
       b.billing_month,
       b.units_consumed,
       b.amount,
       b.payment_status,
       ts.rate_per_unit,
       ts.consumer_category,
       TO_CHAR(b.due_date, 'YYYY-MM-DD') AS due_date
FROM   bill b
JOIN   consumer c     ON b.consumer_id = c.consumer_id
JOIN   tariff_slab ts ON b.slab_id     = ts.slab_id
ORDER  BY b.bill_id DESC;


-- Query 9: Calculate total units consumed per distribution area
SELECT da.zone,
       da.city,
       SUM(mr.units_consumed) AS total_units_consumed,
       COUNT(mr.reading_id)   AS total_readings
FROM   meter_reading mr
JOIN   connection conn      ON mr.connection_id = conn.connection_id
JOIN   distribution_area da ON conn.area_id     = da.area_id
GROUP  BY da.zone, da.city
ORDER  BY total_units_consumed DESC;


-- Query 10: Generate admin dashboard summary statistics
SELECT
  (SELECT COUNT(*) FROM power_grid)                                     AS total_grids,
  (SELECT COUNT(*) FROM distribution_area)                              AS total_areas,
  (SELECT COUNT(*) FROM consumer)                                       AS total_consumers,
  (SELECT COUNT(*) FROM connection WHERE status = 'Active')             AS active_connections,
  (SELECT COALESCE(SUM(units_supplied), 0) FROM area_monthly_supply)    AS total_units_supplied;


-- Query 11: Generate consumer dashboard summary for pending bills and amount due
SELECT
  (SELECT COUNT(*)
   FROM   connection
   WHERE  consumer_id = 1002 AND status = 'Active')          AS active_meters,

  (SELECT COUNT(*)
   FROM   bill
   WHERE  consumer_id = 1002 AND payment_status != 'Paid')   AS pending_bills,

  (SELECT COALESCE(SUM(amount), 0)
   FROM   bill
   WHERE  consumer_id = 1002 AND payment_status != 'Paid')   AS total_amount_due;


-- Query 12: Find high-consumption areas where total units exceed 500
SELECT da.zone,
       da.city,
       SUM(mr.units_consumed) AS total_units
FROM   meter_reading mr
JOIN   connection conn      ON mr.connection_id = conn.connection_id
JOIN   distribution_area da ON conn.area_id     = da.area_id
GROUP  BY da.zone, da.city
HAVING SUM(mr.units_consumed) > 500
ORDER  BY total_units DESC;


-- Query 13: Find consumers who have at least one unpaid bill
SELECT c.consumer_id,
       c.full_name,
       c.permanent_address
FROM   consumer c
WHERE  EXISTS (
    SELECT 1
    FROM   bill b
    WHERE  b.consumer_id   = c.consumer_id
      AND  b.payment_status != 'Paid'
)
ORDER  BY c.consumer_id;


-- Query 14: Find active connections that do not have any meter reading yet
SELECT conn.connection_id,
       conn.consumer_id,
       conn.connection_type,
       conn.status
FROM   connection conn
WHERE  conn.status = 'Active'
  AND  NOT EXISTS (
      SELECT 1
      FROM   meter_reading mr
      WHERE  mr.connection_id = conn.connection_id
  )
ORDER  BY conn.connection_id;


-- Query 15: Show consumers whose bill amount is above the overall average
SELECT b.bill_id,
       c.full_name,
       b.billing_month,
       b.amount,
       ROUND((SELECT AVG(amount) FROM bill)::NUMERIC, 2) AS avg_bill_amount
FROM   bill b
JOIN   consumer c ON b.consumer_id = c.consumer_id
WHERE  b.amount > (SELECT AVG(amount) FROM bill)
ORDER  BY b.amount DESC;


-- Query 16: Detect power loss by comparing supplied vs consumed units per area
SELECT da.zone,
       da.city,
       ams.supply_month,
       ams.units_supplied,
       COALESCE(SUM(mr.units_consumed), 0) AS units_consumed,
       (ams.units_supplied - COALESCE(SUM(mr.units_consumed), 0)) AS power_loss,
       ROUND((
           (ams.units_supplied - COALESCE(SUM(mr.units_consumed), 0))
           / ams.units_supplied * 100
       )::NUMERIC, 2) AS loss_percentage
FROM   area_monthly_supply ams
JOIN   distribution_area da ON ams.area_id          = da.area_id
LEFT JOIN connection conn   ON da.area_id            = conn.area_id
LEFT JOIN meter_reading mr  ON conn.connection_id    = mr.connection_id
                           AND ams.supply_month      = mr.billing_month
GROUP  BY da.zone, da.city, ams.supply_month, ams.units_supplied
ORDER  BY power_loss DESC;


-- Query 17: Rank consumers by total electricity consumption
SELECT c.consumer_id,
       c.full_name,
       SUM(mr.units_consumed) AS total_units,
       RANK() OVER (ORDER BY SUM(mr.units_consumed) DESC) AS consumption_rank
FROM   consumer c
JOIN   connection conn  ON c.consumer_id   = conn.consumer_id
JOIN   meter_reading mr ON conn.connection_id = mr.connection_id
GROUP  BY c.consumer_id, c.full_name
ORDER  BY consumption_rank;


-- Query 18: Show month-over-month consumption change for each connection
SELECT connection_id,
       billing_month,
       units_consumed,
       LAG(units_consumed) OVER (
           PARTITION BY connection_id ORDER BY billing_month
       ) AS prev_month_units,
       (units_consumed - LAG(units_consumed) OVER (
           PARTITION BY connection_id ORDER BY billing_month
       )) AS change_in_units
FROM   meter_reading
ORDER  BY connection_id, billing_month;


-- Query 19: Mark a specific bill as paid
UPDATE bill
SET    payment_status = 'Paid',
       paid_on        = NOW()
WHERE  bill_id        = 8001
  AND  payment_status != 'Paid';


-- Query 20: Insert a new meter reading record
INSERT INTO meter_reading (
    reading_id, connection_id, billing_month,
    previous_reading, current_reading, units_consumed
) VALUES (
    4, 5001, '2025-12',
    1200, 1415, 1415 - 1200
);


-- Query 21: Deactivate a consumer connection
UPDATE connection
SET    status = 'Inactive'
WHERE  connection_id = 5004
  AND  status = 'Active';


-- Query 22: List all consumers, including those without any bills
SELECT c.consumer_id,
       c.full_name,
       c.permanent_address,
       COUNT(b.bill_id)          AS total_bills,
       COALESCE(SUM(b.amount), 0) AS total_billed_amount
FROM   consumer c
LEFT JOIN bill b ON c.consumer_id = b.consumer_id
GROUP  BY c.consumer_id, c.full_name, c.permanent_address
ORDER  BY total_billed_amount DESC;


-- Query 23: Find grids that supply areas in both Delhi and Bengaluru
SELECT grid_id, grid_name
FROM   power_grid
WHERE  grid_id IN (
    SELECT DISTINCT grid_id FROM distribution_area WHERE LOWER(city) = 'delhi'
    INTERSECT
    SELECT DISTINCT grid_id FROM distribution_area WHERE LOWER(city) = 'bengaluru'
);


-- Query 24: Get the most recent meter reading for each connection
SELECT mr.reading_id,
       mr.connection_id,
       mr.billing_month,
       mr.current_reading,
       mr.units_consumed
FROM   meter_reading mr
WHERE  mr.billing_month = (
    SELECT MAX(mr2.billing_month)
    FROM   meter_reading mr2
    WHERE  mr2.connection_id = mr.connection_id
)
ORDER  BY mr.connection_id;


-- Query 25: Look up the tariff slab for a given consumer category and units consumed
SELECT slab_id,
       consumer_category,
       unit_from,
       unit_to,
       rate_per_unit,
       fixed_charge
FROM   tariff_slab
WHERE  LOWER(consumer_category) = 'domestic'
  AND  65 BETWEEN unit_from AND unit_to
  AND  effective_to IS NULL
LIMIT  1;


-- =============================================================
-- PART 3 : TRIGGERS (Task 5)
-- =============================================================

-- -------------------------------------------------------------
-- Trigger 1 : trg_auto_mark_overdue
-- Table     : bill
-- Fires     : BEFORE INSERT OR UPDATE
-- Purpose   : If a bill is inserted or updated with
--             payment_status = 'Unpaid' AND its due_date has
--             already passed, automatically change the status
--             to 'Overdue' before saving the row.
--             Eliminates the need for any manual cron job or
--             backend scan to detect overdue bills.
-- -------------------------------------------------------------

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


-- ── Test cases for Trigger 1 ──────────────────────────────────

-- Test A: bill with a past due_date → should auto-change to 'Overdue'
INSERT INTO bill (
    bill_id, consumer_id, connection_id, slab_id,
    billing_month, units_consumed, amount,
    payment_status, generated_on, due_date
) VALUES (
    9999, 1001, 5001, 1,
    '2024-10', 80, 410.00,
    'Unpaid',        -- inserted as Unpaid ...
    '2024-10-01',
    '2024-10-15'     -- ... but due_date is in the past
);

-- Verify: expected payment_status = 'Overdue'
SELECT bill_id, payment_status, due_date FROM bill WHERE bill_id = 9999;

-- Test B: bill with a future due_date → should stay 'Unpaid'
INSERT INTO bill (
    bill_id, consumer_id, connection_id, slab_id,
    billing_month, units_consumed, amount,
    payment_status, generated_on, due_date
) VALUES (
    9998, 1001, 5001, 1,
    '2026-06', 80, 410.00,
    'Unpaid',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days'
);

-- Verify: expected payment_status = 'Unpaid'
SELECT bill_id, payment_status, due_date FROM bill WHERE bill_id = 9998;

-- Cleanup
DELETE FROM bill WHERE bill_id IN (9999, 9998);


-- -------------------------------------------------------------
-- Trigger 2 : trg_validate_reading_continuity
-- Table     : meter_reading
-- Fires     : BEFORE INSERT
-- Purpose   : An electricity meter is cumulative — it never
--             resets. So if last month ended at 1200, this
--             month's previous_reading MUST also be 1200.
--             Raises an error if there is a mismatch.
--             Also auto-computes units_consumed to eliminate
--             manual calculation errors.
-- -------------------------------------------------------------

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION fn_validate_reading_continuity()
RETURNS TRIGGER AS $$
DECLARE
    last_reading NUMERIC;  -- holds the last recorded current_reading
BEGIN
    -- Fetch the most recent current_reading for this connection
    SELECT current_reading
    INTO   last_reading
    FROM   meter_reading
    WHERE  connection_id = NEW.connection_id
    ORDER  BY billing_month DESC
    LIMIT  1;

    -- If a previous reading exists, validate continuity
    -- (First-ever reading for a connection skips this check)
    IF last_reading IS NOT NULL THEN
        IF NEW.previous_reading <> last_reading THEN
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Attach the function to the meter_reading table
CREATE OR REPLACE TRIGGER trg_validate_reading_continuity
    BEFORE INSERT ON meter_reading
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_reading_continuity();


-- ── Test cases for Trigger 2 ──────────────────────────────────
-- Assumption: connection 5001 has billing_month='2025-11', current_reading=1200

-- Test A: CORRECT — previous_reading matches last current_reading
-- Expected: INSERT succeeds, units_consumed auto-set to 215
INSERT INTO meter_reading (
    reading_id, connection_id, billing_month,
    previous_reading, current_reading, units_consumed
) VALUES (
    10, 5001, '2025-12',
    1200,   -- matches last current_reading
    1415,
    0       -- trigger will overwrite this with 215
);

-- Verify: expected units_consumed = 215
SELECT reading_id, billing_month, previous_reading,
       current_reading, units_consumed
FROM   meter_reading
WHERE  reading_id = 10;

-- Test B: WRONG — previous_reading does NOT match → INSERT aborted
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
--  previous_reading (999) does not match last recorded current_reading (1415)."

-- Cleanup
DELETE FROM meter_reading WHERE reading_id = 10;


-- =============================================================
-- END OF FILE
-- =============================================================