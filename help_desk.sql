-- ==========================================
-- 5. HELP DESK / TICKETING SYSTEM
-- ==========================================

DROP TABLE IF EXISTS ticket_reply CASCADE;
DROP TABLE IF EXISTS support_ticket CASCADE;
DROP SEQUENCE IF EXISTS ticket_id_seq CASCADE;
DROP SEQUENCE IF EXISTS reply_id_seq CASCADE;

CREATE SEQUENCE ticket_id_seq START WITH 1000;
CREATE SEQUENCE reply_id_seq START WITH 5000;

CREATE TABLE support_ticket (
    ticket_id INT PRIMARY KEY DEFAULT nextval('ticket_id_seq'),
    consumer_id INT NOT NULL REFERENCES consumer(consumer_id) ON DELETE CASCADE,
    subject VARCHAR(200) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Open', -- States: Open, In Progress, Resolved
    is_satisfied BOOLEAN DEFAULT NULL,          -- User feedback upon resolution
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE ticket_reply (
    reply_id INT PRIMARY KEY DEFAULT nextval('reply_id_seq'),
    ticket_id INT NOT NULL REFERENCES support_ticket(ticket_id) ON DELETE CASCADE,
    sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('consumer', 'admin')),
    message TEXT NOT NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 1. Simulate a consumer (e.g., consumer 1001) creating a ticket
INSERT INTO support_ticket (ticket_id, consumer_id, subject) 
VALUES (1000, 1001, 'My last bill seems unusually high');

-- 2. Simulate the initial message from the consumer
INSERT INTO ticket_reply (ticket_id, sender_role, message) 
VALUES (1000, 'consumer', 'Hello, my usage for March jumped drastically despite being out of town.');

-- 3. Simulate the Admin replying
INSERT INTO ticket_reply (ticket_id, sender_role, message) 
VALUES (1000, 'admin', 'We will send a technician to check your smart meter for faults tomorrow.');

-- 4. View the threaded conversation
SELECT t.subject, r.sender_role, r.message, r.sent_at
FROM support_ticket t
JOIN ticket_reply r ON t.ticket_id = r.ticket_id
WHERE t.ticket_id = 1000
ORDER BY r.sent_at ASC;