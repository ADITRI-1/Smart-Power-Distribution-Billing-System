-- 1) List all active electricity connections
SELECT connection_id,
       consumer_id,
       area_id,
       connection_type,
       load_assign,
       TO_CHAR(installation_date, 'YYYY-MM-DD') AS install_date,
       status
FROM connection
WHERE status = 'Active'
ORDER BY connection_id;


-- 2) Get all unpaid or overdue bills
SELECT bill_id,
       consumer_id,
       connection_id,
       billing_month,
       units_consumed,
       amount,
       payment_status,
       TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date
FROM bill
WHERE payment_status = 'Unpaid'
   OR payment_status = 'Overdue'
ORDER BY due_date ASC;


-- 3) Find consumers whose age lies between 18 and 25
SELECT consumer_id,
       full_name,
       permanent_address,
       age
FROM consumer
WHERE age BETWEEN 18 AND 25
ORDER BY age ASC;


-- 4) Display only grid names and locations
SELECT grid_id,
       grid_name,
       location
FROM power_grid
ORDER BY grid_id;


-- 5) Show full consumer profile along with connection, grid, and zone details
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
FROM consumer c
JOIN connection conn ON c.consumer_id = conn.consumer_id
JOIN distribution_area da ON conn.area_id = da.area_id
JOIN power_grid pg ON da.grid_id = pg.grid_id
WHERE c.consumer_id = 1001;


-- 6) List all distribution areas with their parent grid name
SELECT da.area_id,
       da.zone,
       da.city,
       da.poc,
       pg.grid_name
FROM distribution_area da
JOIN power_grid pg ON da.grid_id = pg.grid_id
ORDER BY da.area_id;


-- 7) Show meter readings with consumer name and connection details
SELECT mr.reading_id,
       mr.connection_id,
       c.full_name AS consumer_name,
       mr.billing_month,
       mr.previous_reading,
       mr.current_reading,
       mr.units_consumed
FROM meter_reading mr
JOIN connection conn ON mr.connection_id = conn.connection_id
JOIN consumer c ON conn.consumer_id = c.consumer_id
ORDER BY mr.reading_id;


-- 8) Display bills with consumer name and applicable tariff rate
SELECT b.bill_id,
       c.full_name AS consumer_name,
       b.billing_month,
       b.units_consumed,
       b.amount,
       b.payment_status,
       ts.rate_per_unit,
       ts.consumer_category,
       TO_CHAR(b.due_date, 'YYYY-MM-DD') AS due_date
FROM bill b
JOIN consumer c ON b.consumer_id = c.consumer_id
JOIN tariff_slab ts ON b.slab_id = ts.slab_id
ORDER BY b.bill_id DESC;


-- 9) Calculate total units consumed per distribution area
SELECT da.zone,
       da.city,
       SUM(mr.units_consumed) AS total_units_consumed,
       COUNT(mr.reading_id) AS total_readings
FROM meter_reading mr
JOIN connection conn ON mr.connection_id = conn.connection_id
JOIN distribution_area da ON conn.area_id = da.area_id
GROUP BY da.zone, da.city
ORDER BY total_units_consumed DESC;


-- 10) Generate admin dashboard summary statistics
SELECT
  (SELECT COUNT(*) FROM power_grid) AS total_grids,
  (SELECT COUNT(*) FROM distribution_area) AS total_areas,
  (SELECT COUNT(*) FROM consumer) AS total_consumers,
  (SELECT COUNT(*) FROM connection
   WHERE status = 'Active') AS active_connections,
  (SELECT COALESCE(SUM(units_supplied), 0)
   FROM area_monthly_supply) AS total_units_supplied;


-- 11) Generate consumer dashboard summary for pending bills and amount due
SELECT
  (SELECT COUNT(*)
   FROM connection
   WHERE consumer_id = 1002
   AND status = 'Active') AS active_meters,

  (SELECT COUNT(*)
   FROM bill
   WHERE consumer_id = 1002
   AND payment_status != 'Paid') AS pending_bills,

  (SELECT COALESCE(SUM(amount), 0)
   FROM bill
   WHERE consumer_id = 1002
   AND payment_status != 'Paid') AS total_amount_due;


-- 12) Find high-consumption areas where total units exceed 500
SELECT da.zone,
       da.city,
       SUM(mr.units_consumed) AS total_units
FROM meter_reading mr
JOIN connection conn ON mr.connection_id = conn.connection_id
JOIN distribution_area da ON conn.area_id = da.area_id
GROUP BY da.zone, da.city
HAVING SUM(mr.units_consumed) > 500
ORDER BY total_units DESC;


-- 13) Find consumers who have at least one unpaid bill
SELECT c.consumer_id,
       c.full_name,
       c.permanent_address
FROM consumer c
WHERE EXISTS (
    SELECT 1
    FROM bill b
    WHERE b.consumer_id = c.consumer_id
      AND b.payment_status != 'Paid'
)
ORDER BY c.consumer_id;


-- 14) Find active connections that do not have any meter reading yet
SELECT conn.connection_id,
       conn.consumer_id,
       conn.connection_type,
       conn.status
FROM connection conn
WHERE conn.status = 'Active'
  AND NOT EXISTS (
      SELECT 1
      FROM meter_reading mr
      WHERE mr.connection_id = conn.connection_id
  )
ORDER BY conn.connection_id;


-- 15) Show consumers whose bill amount is above the overall average bill amount
SELECT b.bill_id,
       c.full_name,
       b.billing_month,
       b.amount,
       ROUND((
           SELECT AVG(amount) FROM bill
       )::NUMERIC, 2) AS avg_bill_amount
FROM bill b
JOIN consumer c ON b.consumer_id = c.consumer_id
WHERE b.amount > (
    SELECT AVG(amount) FROM bill
)
ORDER BY b.amount DESC;


-- 16) Detect power loss by comparing supplied units vs consumed units per area
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
FROM area_monthly_supply ams
JOIN distribution_area da ON ams.area_id = da.area_id
LEFT JOIN connection conn ON da.area_id = conn.area_id
LEFT JOIN meter_reading mr ON conn.connection_id = mr.connection_id
                          AND ams.supply_month = mr.billing_month
GROUP BY da.zone, da.city, ams.supply_month, ams.units_supplied
ORDER BY power_loss DESC;


-- 17) Rank consumers by total electricity consumption
SELECT c.consumer_id,
       c.full_name,
       SUM(mr.units_consumed) AS total_units,
       RANK() OVER (
           ORDER BY SUM(mr.units_consumed) DESC
       ) AS consumption_rank
FROM consumer c
JOIN connection conn ON c.consumer_id = conn.consumer_id
JOIN meter_reading mr ON conn.connection_id = mr.connection_id
GROUP BY c.consumer_id, c.full_name
ORDER BY consumption_rank;


-- 18) Show month-over-month consumption change for each connection
SELECT connection_id,
       billing_month,
       units_consumed,
       LAG(units_consumed) OVER (
           PARTITION BY connection_id
           ORDER BY billing_month
       ) AS prev_month_units,
       (units_consumed -
        LAG(units_consumed) OVER (
            PARTITION BY connection_id
            ORDER BY billing_month
        )) AS change_in_units
FROM meter_reading
ORDER BY connection_id, billing_month;


-- 19) Mark a specific bill as paid
UPDATE bill
SET payment_status = 'Paid',
    paid_on = NOW()
WHERE bill_id = 8001
  AND payment_status != 'Paid';


-- 20) Insert a new meter reading record
INSERT INTO meter_reading (
    reading_id,
    connection_id,
    billing_month,
    previous_reading,
    current_reading,
    units_consumed
)
SELECT 4, 5001, '2026-01', 1415, 1500, 85
WHERE NOT EXISTS (
    SELECT 1
    FROM meter_reading
    WHERE connection_id = 5001
      AND billing_month = '2026-01'
);
-- 21) Deactivate a consumer connection
UPDATE connection
SET status = 'Inactive'
WHERE connection_id = 5004
  AND status = 'Active';


-- 22) List all consumers, including those without any bills
SELECT c.consumer_id,
       c.full_name,
       c.permanent_address,
       COUNT(b.bill_id) AS total_bills,
       COALESCE(SUM(b.amount), 0) AS total_billed_amount
FROM consumer c
LEFT JOIN bill b ON c.consumer_id = b.consumer_id
GROUP BY c.consumer_id, c.full_name, c.permanent_address
ORDER BY total_billed_amount DESC;


-- 23) Find grids that supply distribution areas in both Delhi and Bengaluru
SELECT grid_id, grid_name
FROM power_grid
WHERE grid_id IN (
    SELECT DISTINCT grid_id
    FROM distribution_area
    WHERE LOWER(city) = 'delhi'

    INTERSECT

    SELECT DISTINCT grid_id
    FROM distribution_area
    WHERE LOWER(city) = 'bengaluru'
);


-- 24) Get the most recent meter reading for each connection
SELECT mr.reading_id,
       mr.connection_id,
       mr.billing_month,
       mr.current_reading,
       mr.units_consumed
FROM meter_reading mr
WHERE mr.billing_month = (
    SELECT MAX(mr2.billing_month)
    FROM meter_reading mr2
    WHERE mr2.connection_id = mr.connection_id
)
ORDER BY mr.connection_id;


-- 25) Look up the tariff slab for a given consumer category and units consumed
SELECT slab_id,
       consumer_category,
       unit_from,
       unit_to,
       rate_per_unit,
       fixed_charge
FROM tariff_slab
WHERE LOWER(consumer_category) = 'domestic'
  AND 65 BETWEEN unit_from AND unit_to
  AND effective_to IS NULL
LIMIT 1;
