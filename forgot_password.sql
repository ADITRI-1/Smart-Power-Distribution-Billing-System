-- 1. Add columns to consumer_users
ALTER TABLE consumer_users 
ADD COLUMN email VARCHAR(150) UNIQUE,
ADD COLUMN reset_token VARCHAR(10),
ADD COLUMN token_expiry TIMESTAMP;

-- 2. Add columns to admin_users
ALTER TABLE admin_users 
ADD COLUMN email VARCHAR(150) UNIQUE,
ADD COLUMN reset_token VARCHAR(10),
ADD COLUMN token_expiry TIMESTAMP;

-- 3. Backfill dummy emails so you can test immediately without making new accounts
UPDATE consumer_users SET email = 'aditri@example.com' WHERE username = 'aditri';
UPDATE consumer_users SET email = 'kushagra@example.com' WHERE username = 'kushagra';
UPDATE admin_users SET email = 'admin@smartpower.com' WHERE username = 'admin';