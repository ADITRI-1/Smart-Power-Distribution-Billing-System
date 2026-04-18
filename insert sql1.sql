-- 1. Allow Grids to delete Distribution Areas automatically
ALTER TABLE distribution_area DROP CONSTRAINT IF EXISTS distribution_area_grid_id_fkey;
ALTER TABLE distribution_area ADD CONSTRAINT distribution_area_grid_id_fkey 
    FOREIGN KEY (grid_id) REFERENCES power_grid(grid_id) ON DELETE CASCADE;

-- 2. Allow Areas to delete Supply logs automatically
ALTER TABLE area_monthly_supply DROP CONSTRAINT IF EXISTS area_monthly_supply_area_id_fkey;
ALTER TABLE area_monthly_supply ADD CONSTRAINT area_monthly_supply_area_id_fkey 
    FOREIGN KEY (area_id) REFERENCES distribution_area(area_id) ON DELETE CASCADE;

-- 3. Protect Financials: Make Consumer and Connection nullable in Bills
ALTER TABLE bill ALTER COLUMN consumer_id DROP NOT NULL;
ALTER TABLE bill ALTER COLUMN connection_id DROP NOT NULL;

-- 4. When a Consumer is deleted, keep their bills but set the ID to NULL
ALTER TABLE bill DROP CONSTRAINT IF EXISTS bill_consumer_id_fkey;
ALTER TABLE bill ADD CONSTRAINT bill_consumer_id_fkey 
    FOREIGN KEY (consumer_id) REFERENCES consumer(consumer_id) ON DELETE SET NULL;

-- 5. When a Connection is deleted, keep the bills but set the ID to NULL
ALTER TABLE bill DROP CONSTRAINT IF EXISTS bill_connection_id_fkey;
ALTER TABLE bill ADD CONSTRAINT bill_connection_id_fkey 
    FOREIGN KEY (connection_id) REFERENCES connection(connection_id) ON DELETE SET NULL;


-- 1. Remove the secondary admin account
DELETE FROM admin_users WHERE username = 'gaurav_admin';

-- 2. Update the main Admin account password to: Admin@123
UPDATE admin_users 
SET password_hash = 'scrypt:32768:8:1$iFgZYz4NfNNNzKr7$7beaa4f2bab0def23fe2db94163c40cb237df2e23d8f641a55dfb59b7d48324d355157d77a37872c18ee297f66104c3762460f5c62da9b4d199f76c996056402' 
WHERE username = 'admin';

-- 3. Update ALL existing consumer accounts (aditri, gaurav, kushagra) password to: User@123
UPDATE consumer_users 
SET password_hash = 'scrypt:32768:8:1$QSWWimvK8ukUgoro$d3d62a5f173172076e9427a9f3aa42dcf2922f9f81603c94377214e7a957a27371a18ca24fc3e692403590af12d975bc056b12ec62a2fb69aadae846d0a9a6b7';