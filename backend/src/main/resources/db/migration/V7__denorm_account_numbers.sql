-- Denormalize account_number into transfers so queries don't need to JOIN accounts
-- (which would be filtered by RLS, causing cross-customer account numbers to appear as NULL)

ALTER TABLE transfers
    ADD COLUMN from_account_number VARCHAR(20),
    ADD COLUMN to_account_number   VARCHAR(20);

UPDATE transfers t
SET from_account_number = a.account_number
FROM accounts a WHERE a.id = t.from_account_id;

UPDATE transfers t
SET to_account_number = a.account_number
FROM accounts a WHERE a.id = t.to_account_id;

ALTER TABLE transfers
    ALTER COLUMN from_account_number SET NOT NULL,
    ALTER COLUMN to_account_number   SET NOT NULL;
