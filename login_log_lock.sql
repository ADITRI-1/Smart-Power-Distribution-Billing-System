-- 1. Create the Audit Log Table (To track who is logging in)
CREATE TABLE login_logs (
    log_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    login_type VARCHAR(20) NOT NULL,
    attempt_time TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) NOT NULL, -- 'Success', 'Failed', 'Locked Out'
    ip_address VARCHAR(45) -- Good practice for security logs
);

-- 2. Add Lockout Tracking to Consumers
ALTER TABLE consumer_users 
ADD COLUMN failed_attempts INT DEFAULT 0,
ADD COLUMN locked_until TIMESTAMP;

-- 3. Add Lockout Tracking to Admins
ALTER TABLE admin_users 
ADD COLUMN failed_attempts INT DEFAULT 0,
ADD COLUMN locked_until TIMESTAMP;