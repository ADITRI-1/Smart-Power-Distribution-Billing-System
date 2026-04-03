-- =============================================================
-- TRANSACTION T1 : Normal Commit
-- TYPE    : Successful multi-step transaction (COMMIT)
-- CONCEPT : Atomicity — add a meter reading AND generate its
--           bill together. If either step fails, both are undone.
-- MAPS TO : Admin Panel → Add Reading (Application 1)
-- =============================================================

-- ── Before state ─────────────────────────────────────────────
SELECT 'T1 BEFORE' AS checkpoint,
       COUNT(*) AS total_readings FROM meter_reading;
 
SELECT 'T1 BEFORE' AS checkpoint,
       COUNT(*) AS total_bills FROM bill;
 
-- ── Transaction ──────────────────────────────────────────────
BEGIN;
    -- Step 1: Verify the connection is Active before touching it
    SELECT connection_id, consumer_id, connection_type, status
    FROM   connection
    WHERE  connection_id = 5003 AND status = 'Active';

    -- Step 2: Insert a new meter reading for connection 5003
    -- (Trigger trg_validate_reading_continuity will auto-verify
    --  previous_reading matches last current_reading = 2200)
    INSERT INTO meter_reading (
        reading_id, connection_id, billing_month,
        previous_reading, current_reading, units_consumed
    ) VALUES (
        20, 5003, '2025-12',
        2200, 2450,
        0    -- trigger auto-computes this as 250
    );
    -- Step 3: Insert the generated bill for consumer 1003
    INSERT INTO bill (
        bill_id, consumer_id, connection_id, slab_id,
        billing_month, units_consumed, amount,
        payment_status, generated_on, due_date
    ) VALUES (
        7001, 1003, 5003, 1,
        '2025-12', 250, 1175.00,
        'Unpaid', CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days'
    );
COMMIT;
 
-- ── After state: both rows must now exist ────────────────────
SELECT 'T1 AFTER' AS checkpoint, reading_id, billing_month,
       previous_reading, current_reading, units_consumed
FROM   meter_reading WHERE reading_id = 20;
 
SELECT 'T1 AFTER' AS checkpoint, bill_id, consumer_id,
       billing_month, amount, payment_status
FROM   bill WHERE bill_id = 7001;
 
 
-- =============================================================
-- TRANSACTION T2 : Normal Commit
-- TYPE    : Successful UPDATE transaction (COMMIT)
-- CONCEPT : Consistency — mark a bill as Paid and record the
--           exact timestamp. Guards against paying an already
--           paid bill using a conditional WHERE clause.
-- MAPS TO : Consumer Portal → Pay Bill button
-- =============================================================
 
-- First insert a fresh Unpaid bill to pay in this demo
INSERT INTO bill (
    bill_id, consumer_id, connection_id, slab_id,
    billing_month, units_consumed, amount,
    payment_status, generated_on, due_date
) VALUES (
    7002, 1001, 5001, 1,
    '2026-01', 90, 455.00,
    'Unpaid', CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days'
);

-- ── Before state ─────────────────────────────────────────────
SELECT 'T2 BEFORE' AS checkpoint,
       bill_id, payment_status, paid_on
FROM   bill WHERE bill_id = 7002;
 
-- ── Transaction ──────────────────────────────────────────────
BEGIN;
 
    -- Step 1: Lock the row so no other transaction can touch it
    SELECT bill_id, amount, payment_status
    FROM   bill
    WHERE  bill_id = 7002
    FOR UPDATE;
 
    -- Step 2: Mark as Paid only if it is currently Unpaid
    UPDATE bill
    SET    payment_status = 'Paid',
           paid_on        = NOW()
    WHERE  bill_id        = 7002
      AND  payment_status = 'Unpaid';
 
COMMIT;
 
-- ── After state: payment_status must be Paid ─────────────────
SELECT 'T2 AFTER' AS checkpoint,
       bill_id, payment_status, paid_on
FROM   bill WHERE bill_id = 7002;
 
 
-- =============================================================
-- TRANSACTION T3 : Intentional Rollback
-- TYPE    : Failed transaction → ROLLBACK
-- CONCEPT : Atomicity — if any step in a transaction fails,
--           ALL previous steps in the same transaction are
--           also undone. The DB stays consistent.
-- SCENARIO: Admin tries to deactivate a connection AND insert
--           a duplicate bill in the same transaction.
--           The duplicate bill causes a unique-key violation,
--           so the connection deactivation is also rolled back.
-- =============================================================
 
-- ── Before state ─────────────────────────────────────────────
SELECT 'T3 BEFORE' AS checkpoint,
       connection_id, status
FROM   connection WHERE connection_id = 5002;
 
-- ── Transaction ──────────────────────────────────────────────
BEGIN;
 
    -- Step 1: Deactivate connection 5002
    UPDATE connection
    SET    status = 'Inactive'
    WHERE  connection_id = 5002;
 
    -- Verify inside transaction (should show Inactive right now)
    SELECT 'T3 INSIDE (before rollback)' AS checkpoint,
           connection_id, status
    FROM   connection WHERE connection_id = 5002;
 
    -- Step 2: Try to insert a bill that already exists
    -- bill_id 9000 + connection_id 5002 + billing_month '2025-11'
    -- violates the unique index uq_bill_conn_month_ci → ERROR
    INSERT INTO bill (
        bill_id, consumer_id, connection_id, slab_id,
        billing_month, units_consumed, amount,
        payment_status, generated_on, due_date
    ) VALUES (
        9000, 1002, 5002, 3,   -- bill_id 9000 already exists!
        '2025-11', 80, 400.00,
        'Unpaid', CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days'
    );
 
ROLLBACK; -- rolls back BOTH the UPDATE and the failed INSERT
 
-- ── After state: connection must still be Active ─────────────
SELECT 'T3 AFTER (rollback confirmed)' AS checkpoint,
       connection_id, status
FROM   connection WHERE connection_id = 5002;
-- Expected: status = 'Active'  ← rollback worked ✓
 
 
-- =============================================================
-- TRANSACTION T4 : SAVEPOINT — Partial Rollback
-- TYPE    : Transaction with SAVEPOINT
-- CONCEPT : Durability + fine-grained control — a SAVEPOINT
--           lets you undo only part of a transaction without
--           losing everything. Like a checkpoint inside a game.
-- SCENARIO: Admin updates an address (valid), then accidentally
--           sets age to 15 (violates CHECK age >= 18).
--           ROLLBACK TO SAVEPOINT undoes only the bad update;
--           the address change is preserved on COMMIT.
-- =============================================================
 
-- ── Before state ─────────────────────────────────────────────
SELECT 'T4 BEFORE' AS checkpoint,
       consumer_id, full_name, permanent_address, age
FROM   consumer WHERE consumer_id = 1004;
 
-- ── Transaction ──────────────────────────────────────────────
BEGIN;
 
    -- Step 1: Valid update — fix the address
    UPDATE consumer
    SET    permanent_address = 'Koramangala, Bengaluru'
    WHERE  consumer_id = 1004;
 
    -- Create a savepoint AFTER the valid update
    SAVEPOINT sp_after_address;
 
    -- Step 2: Accidental bad update — age below minimum
    UPDATE consumer
    SET    age = 15          -- violates CHECK (age >= 18)
    WHERE  consumer_id = 1004;
 
    -- Oops! Roll back only to savepoint — undo the bad age update
    ROLLBACK TO SAVEPOINT sp_after_address;
 
    -- Step 3: Correct the age properly
    UPDATE consumer
    SET    age = 24
    WHERE  consumer_id = 1004;
 
COMMIT;
 
-- ── After state: address updated, age = 24 ───────────────────
SELECT 'T4 AFTER' AS checkpoint,
       consumer_id, full_name, permanent_address, age
FROM   consumer WHERE consumer_id = 1004;
-- Expected: permanent_address = 'Koramangala, Bengaluru', age = 24  ✓
 
 
-- =============================================================
-- TRANSACTION T5 : Isolation Level Demo
-- TYPE    : READ COMMITTED (default) vs REPEATABLE READ
-- CONCEPT : Isolation — shows how PostgreSQL prevents dirty
--           reads. A transaction cannot see uncommitted changes
--           made by another transaction.
-- HOW TO RUN:
--   Open TWO pgAdmin Query Tool tabs.
--   Run the SESSION A steps in Tab 1.
--   Run the SESSION B steps in Tab 2.
--   Follow the step numbers in order.
-- =============================================================
 
-- ╔══════════════════════════════════════════════════════════╗
-- ║  SESSION A  (run in Tab 1)                               ║
-- ╚══════════════════════════════════════════════════════════╝
 
-- [A-Step 1] Start transaction and update bill amount
BEGIN;
    UPDATE bill
    SET    amount = 999.99
    WHERE  bill_id = 8001;
 
    -- Do NOT commit yet — keep this transaction open
    -- Now switch to Tab 2 and run Session B steps
 
-- ╔══════════════════════════════════════════════════════════╗
-- ║  SESSION B  (run in Tab 2 while Session A is still open) ║
-- ╚══════════════════════════════════════════════════════════╝
 
-- [B-Step 1] Try to read the same bill
-- Under READ COMMITTED (default): sees original value 342.5
-- (cannot see Session A's uncommitted change = no dirty read)
SELECT 'SESSION B READ' AS checkpoint,
       bill_id, amount, payment_status
FROM   bill
WHERE  bill_id = 8001;
-- Expected: amount = 342.50  (original, not 999.99)  ✓
 
-- [B-Step 2] Try to update the same row
-- This will BLOCK/HANG because Session A holds a row lock
-- You will see the spinner in pgAdmin — this is the conflict!
BEGIN;
    UPDATE bill
    SET    amount = 500.00
    WHERE  bill_id = 8001;
    --  Tab 2 is now BLOCKED, waiting for Session A to finish
 
-- ╔══════════════════════════════════════════════════════════╗
-- ║  Back to SESSION A (Tab 1) — resolve the conflict        ║
-- ╚══════════════════════════════════════════════════════════╝
 
-- [A-Step 2] Commit Session A
COMMIT;
-- Session B was waiting — it will now unblock and execute
 
-- ╔══════════════════════════════════════════════════════════╗
-- ║  Back to SESSION B (Tab 2) — finish it                   ║
-- ╚══════════════════════════════════════════════════════════╝
 
-- [B-Step 3] Commit Session B (runs after A's lock is released)
COMMIT;
 
-- [B-Step 4] Check final value — last writer (Session B) wins
SELECT 'CONFLICT RESULT' AS checkpoint,
       bill_id, amount
FROM   bill
WHERE  bill_id = 8001;
-- Expected: amount = 500.00 (Session B's value, last writer wins) ✓
 
-- Restore original value after demo
UPDATE bill SET amount = 342.50 WHERE bill_id = 8001;
 
 
-- =============================================================
-- TRANSACTION T6 : Constraint Violation Rollback
-- TYPE    : Auto-rollback on constraint violation
-- CONCEPT : Integrity — PostgreSQL automatically aborts the
--           entire transaction when a constraint is violated,
--           protecting the database from bad data.
-- SCENARIO: Try to insert a consumer with age = 16, which
--           violates the CHECK (age >= 18) constraint.
-- =============================================================
 
-- ── Before state ─────────────────────────────────────────────
SELECT 'T6 BEFORE' AS checkpoint,
       COUNT(*) AS total_consumers FROM consumer;
 
-- ── Transaction ──────────────────────────────────────────────
BEGIN;
 
    -- Step 1: Insert a valid grid (this succeeds)
    INSERT INTO power_grid VALUES (3, 'East Side Grid', 'Mumbai');
 
    -- Step 2: Try to insert consumer with age = 16 (will fail)
    INSERT INTO consumer VALUES
    (1005, 'Minor User', 'Some Address, Mumbai', 16);
    -- ↑ ERROR: violates check constraint "consumer_age_check"
 
ROLLBACK; -- entire transaction undone, including the grid insert
 
-- ── After state: grid 3 must NOT exist (rollback worked) ─────
SELECT 'T6 AFTER' AS checkpoint,
       COUNT(*) AS total_consumers FROM consumer;
-- Expected: same count as before  ✓
 
SELECT 'T6 AFTER' AS checkpoint,
       COUNT(*) AS grid_3_exists
FROM   power_grid WHERE grid_id = 3;
-- Expected: 0 (grid was also rolled back)  ✓
 
 
-- =============================================================
-- FINAL STATE CHECK — run after all transactions
-- Shows the net effect of all committed transactions on the DB
-- =============================================================
 
SELECT '── FINAL STATE ──' AS section,
       '' AS value;
 
SELECT 'meter_reading count' AS table_name,
       COUNT(*) AS total_rows FROM meter_reading
UNION ALL
SELECT 'bill count',          COUNT(*) FROM bill
UNION ALL
SELECT 'consumer count',      COUNT(*) FROM consumer
UNION ALL
SELECT 'connection count',    COUNT(*) FROM connection;
 
-- Bills inserted by T1 and T2 that survived (committed)
SELECT 'Committed bills from T1 & T2' AS note,
       bill_id, consumer_id, billing_month,
       amount, payment_status
FROM   bill
WHERE  bill_id IN (7001, 7002)
ORDER  BY bill_id;
 
-- Consumer 1004 updated by T4 (savepoint demo)
SELECT 'Consumer 1004 after T4 savepoint' AS note,
       consumer_id, permanent_address, age
FROM   consumer
WHERE  consumer_id = 1004;
 
 
-- =============================================================
-- CLEANUP — remove demo rows added during Task 6
-- Run this after your demo/viva to restore original state
-- =============================================================
 
DELETE FROM bill          WHERE bill_id      IN (7001, 7002);
DELETE FROM meter_reading WHERE reading_id   = 20;
UPDATE consumer
SET    permanent_address = 'Indiranagar, Bengaluru', age = 23
WHERE  consumer_id = 1004;