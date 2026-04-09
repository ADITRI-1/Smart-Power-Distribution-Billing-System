-- Add a payment method column to track Cash, UPI, Card, etc.
ALTER TABLE bill ADD COLUMN payment_method VARCHAR(50);

