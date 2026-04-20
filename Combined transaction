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
 
 ROLLBACK;
-- =============================================================
-- TRANSACTION T2 : Normal Commit (Paying an Overdue Bill)
-- TYPE    : Successful UPDATE transaction (COMMIT)
-- CONCEPT : Consistency — mark a bill as Paid and record the
--           exact timestamp. Guards against double payments.
-- =============================================================


-- 1. Remove the old one
DELETE FROM bill WHERE bill_id = 7002;

-- 2. Insert with TODAY'S DATE so it stays at the top of the Admin list
INSERT INTO bill (
    bill_id, consumer_id, connection_id, slab_id,
    billing_month, units_consumed, amount,
    payment_status, generated_on, due_date
) VALUES (
    7002, 1003, 5003, 1,
    '2024-08', 90, 455.00,
    'Overdue', 
    CURRENT_DATE, -- Set to today
    CURRENT_DATE  -- Set to today so it sorts to the top
);

-- ── Transaction Block ────────────────────────────────────────
BEGIN;
 
    SELECT bill_id, amount, payment_status
    FROM   bill
    WHERE  bill_id = 7002
    FOR UPDATE;
 
    UPDATE bill
    SET    payment_status = 'Paid',
           paid_on        = NOW(),
           payment_method = 'Online Transaction' 
    WHERE  bill_id        = 7002
      AND  payment_status IN ('Unpaid', 'Overdue');
 
COMMIT;

-- 3. Verify it is still there
SELECT * FROM bill WHERE bill_id = 7002;
-- ── After state: payment_status must be Paid ─────────────────
SELECT 'T2 AFTER' AS checkpoint,
       bill_id, payment_status, paid_on, payment_method
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

-- ── Before state ─────────────────────────────────────────────
-- =============================================================
-- TRANSACTION T3 : Success Demo (Commit)
-- CONCEPT : Atomicity — Both steps must save together.
-- =============================================================

-- 1. Ensure 5001 is Active before we start the demo
UPDATE connection SET status = 'Active' WHERE connection_id = 5001;

BEGIN;

    -- Step 1: Deactivate connection 5001
    UPDATE connection
    SET    status = 'Inactive'
    WHERE  connection_id = 5001;

    -- Step 2: Insert a valid bill specifically for 5001 
    -- (Matching the connection ID is crucial for consistency)
    INSERT INTO bill (
        bill_id, consumer_id, connection_id, slab_id,
        billing_month, units_consumed, amount,
        payment_status, generated_on, due_date
    ) VALUES (
        nextval('bill_id_seq'), 
        (SELECT consumer_id FROM connection WHERE connection_id = 5001), 
        5001, 
        1, 
        '2026-03', 100, 500.00,
        'Unpaid', CURRENT_DATE, (TO_DATE('2026-03-01', 'YYYY-MM-DD') + INTERVAL '1 month' + INTERVAL '14 days')::DATE
    );

COMMIT; 
SELECT 'T3 AFTER (rollback confirmed)' AS checkpoint,
       connection_id, status
FROM   connection WHERE connection_id = 5001;
-- Expected: status = 'Active'  ← rollback worked ✓
 ROLLBACK;
 
-- =============================================================
-- TRANSACTION T4 : Isolation Level Demo
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
 ROLLBACK;
-- ╔══════════════════════════════════════════════════════════╗
-- ║  SESSION A  (run in Tab 1)                               ║
-- ╚══════════════════════════════════════════════════════════╝
-- [A-Step 1] Start transaction and update bill amount
BEGIN;
    UPDATE bill
    SET    amount = 999.99
    WHERE  bill_id = 10033;
 
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
WHERE  bill_id = 10033;
-- Expected: amount = 342.50  (original, not 999.99)  ✓
 
-- [B-Step 2] Try to update the same row
-- This will BLOCK/HANG because Session A holds a row lock
-- You will see the spinner in pgAdmin — this is the conflict!
BEGIN;
    UPDATE bill
    SET    amount = 500.00
    WHERE  bill_id = 10033;
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
WHERE  bill_id = 10033;
-- Expected: amount = 500.00 (Session B's value, last writer wins) ✓
 
-- Restore original value after demo
UPDATE bill SET amount = 342.50 WHERE bill_id = 10033;
 
