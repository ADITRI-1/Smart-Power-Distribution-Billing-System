DROP TABLE IF EXISTS bill CASCADE;
DROP TABLE IF EXISTS meter_reading CASCADE;
DROP TABLE IF EXISTS area_monthly_supply CASCADE;
DROP TABLE IF EXISTS connection CASCADE;
DROP TABLE IF EXISTS tariff_slab CASCADE;
DROP TABLE IF EXISTS consumer CASCADE;
DROP TABLE IF EXISTS distribution_area CASCADE;
DROP TABLE IF EXISTS power_grid CASCADE;

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
  CONSTRAINT chk_paid_on CHECK
     (paid_on IS NULL OR paid_on::date >= generated_on)
);

CREATE UNIQUE INDEX uq_bill_conn_month_ci
ON bill (connection_id, LOWER(billing_month));


CREATE INDEX idx_distribution_area_grid ON distribution_area(grid_id);
CREATE INDEX idx_connection_consumer ON connection(consumer_id);
CREATE INDEX idx_connection_area ON connection(area_id);


INSERT INTO power_grid VALUES
(1, 'North City Grid', 'Delhi'),
(2, 'South Metro Grid', 'Bengaluru');

INSERT INTO power_grid VALUES (3, 'north city grid', 'Delhi');

INSERT INTO distribution_area VALUES
(101, 1, 'Central Zone', 'Delhi', 'Rohit Verma'),
(102, 1, 'West Zone',    'Delhi', 'Anjali Mehta'),
(201, 2, 'IT Corridor', 'Bengaluru', 'Suresh Rao');


INSERT INTO distribution_area VALUES
(104,2,'central zone', 'delhi', 'JAI JAWAAN');

INSERT INTO consumer VALUES
(1001, 'Aditri Jain',  'Connaught Place, Delhi', 22),
(1002, 'Gaurav Jindal','Rajouri Garden, Delhi', 29),
(1003, 'Kushagra',     'HSR Layout, Bengaluru', 25),
(1004, 'Parv Jain',    'Indiranagar, Bengaluru', 23);

INSERT INTO connection VALUES
(5001, 1001, 101, 'Connaught Place, Delhi', 'Domestic',   '2kW', '2024-04-10', 'Active'),
(5002, 1002, 102, 'Rajouri Garden, Delhi',  'Commercial', '5kW', '2024-06-15', 'Active'),
(5003, 1003, 201, 'HSR Layout, Bengaluru',  'Domestic',   '3kW', '2024-05-05', 'Active'),
(5004, 1004, 201, 'Indiranagar, Bengaluru', 'Domestic',   '2kW', '2024-07-01', 'Active');

INSERT INTO connection VALUES
(6001, 1001, 101, 'connaught place, delhi', 'Domestic', '2kW', '2024-08-01', 'Active');

INSERT INTO area_monthly_supply VALUES
(9001, 101, '2025-11', 120000, '2025-11-30 20:00:00'),
(9002, 102, '2025-11',  95000, '2025-11-30 20:00:00'),
(9003, 201, '2025-11', 110500, '2025-11-30 20:00:00');

INSERT INTO area_monthly_supply VALUES
(9010, 101, '2025-11', 130000, '2025-11-30 20:00:00');

INSERT INTO tariff_slab VALUES
(1, 'Domestic', 0, 100, 4.5, 50, '2024-04-01', NULL),
(2, 'Domestic', 100, 300, 6.0, 75, '2024-04-01', NULL),
(3, 'Commercial', 0, 999999, 8.5, 200, '2024-04-01', NULL);

INSERT INTO tariff_slab VALUES
(4, 'domestic', 0, 100, 5, 60, '2024-04-01', NULL);

INSERT INTO bill VALUES
(8001, 1001, 5001, 1, '2025-11', 65, 342.5, 'Paid', '2025-12-01', '2025-12-15', '2025-12-10');

INSERT INTO bill VALUES
(9000, 1001, 5001, 1, '2025-11', 80, 400, 'Paid', '2025-12-01', '2025-12-15', NULL);