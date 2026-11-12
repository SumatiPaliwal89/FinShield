-- Rich seed data to make the demo look realistic and full
-- Uses direct INSERT (bypassing fn_post_transfer) for historical records
-- Audit chain triggers fire automatically via trg_audit_transfer

DO $$
DECLARE
    id_a1 BIGINT; id_a2 BIGINT; id_b1 BIGINT; id_c1 BIGINT;
    t_id  UUID;
BEGIN
    SELECT id INTO id_a1 FROM accounts WHERE account_number = 'FS0000000001';
    SELECT id INTO id_a2 FROM accounts WHERE account_number = 'FS0000000002';
    SELECT id INTO id_b1 FROM accounts WHERE account_number = 'FS0000000003';
    SELECT id INTO id_c1 FROM accounts WHERE account_number = 'FS0000000004';

    -- T1: Alice → Bob  ₹5,000  (10 days ago)
    INSERT INTO transfers(from_account_id, to_account_id, from_account_number, to_account_number, amount, created_at)
    VALUES (id_a1, id_b1, 'FS0000000001', 'FS0000000003', 5000.00, now() - interval '10 days')
    RETURNING id INTO t_id;
    INSERT INTO ledger_entries(transfer_id, account_id, entry_type, amount, created_at)
    VALUES (t_id, id_a1, 'DEBIT',  5000.00, now() - interval '10 days'),
           (t_id, id_b1, 'CREDIT', 5000.00, now() - interval '10 days');

    -- T2: Bob → Carol  ₹2,500  (8 days ago)
    INSERT INTO transfers(from_account_id, to_account_id, from_account_number, to_account_number, amount, created_at)
    VALUES (id_b1, id_c1, 'FS0000000003', 'FS0000000004', 2500.00, now() - interval '8 days')
    RETURNING id INTO t_id;
    INSERT INTO ledger_entries(transfer_id, account_id, entry_type, amount, created_at)
    VALUES (t_id, id_b1, 'DEBIT',  2500.00, now() - interval '8 days'),
           (t_id, id_c1, 'CREDIT', 2500.00, now() - interval '8 days');

    -- T3: Alice FS2 → Alice FS1  ₹1,000  (7 days ago — internal transfer)
    INSERT INTO transfers(from_account_id, to_account_id, from_account_number, to_account_number, amount, created_at)
    VALUES (id_a2, id_a1, 'FS0000000002', 'FS0000000001', 1000.00, now() - interval '7 days')
    RETURNING id INTO t_id;
    INSERT INTO ledger_entries(transfer_id, account_id, entry_type, amount, created_at)
    VALUES (t_id, id_a2, 'DEBIT',  1000.00, now() - interval '7 days'),
           (t_id, id_a1, 'CREDIT', 1000.00, now() - interval '7 days');

    -- T4: Carol → Alice FS1  ₹500  (6 days ago)
    INSERT INTO transfers(from_account_id, to_account_id, from_account_number, to_account_number, amount, created_at)
    VALUES (id_c1, id_a1, 'FS0000000004', 'FS0000000001', 500.00, now() - interval '6 days')
    RETURNING id INTO t_id;
    INSERT INTO ledger_entries(transfer_id, account_id, entry_type, amount, created_at)
    VALUES (t_id, id_c1, 'DEBIT',  500.00, now() - interval '6 days'),
           (t_id, id_a1, 'CREDIT', 500.00, now() - interval '6 days');

    -- T5: Alice FS1 → Carol  ₹3,000  (5 days ago)
    INSERT INTO transfers(from_account_id, to_account_id, from_account_number, to_account_number, amount, created_at)
    VALUES (id_a1, id_c1, 'FS0000000001', 'FS0000000004', 3000.00, now() - interval '5 days')
    RETURNING id INTO t_id;
    INSERT INTO ledger_entries(transfer_id, account_id, entry_type, amount, created_at)
    VALUES (t_id, id_a1, 'DEBIT',  3000.00, now() - interval '5 days'),
           (t_id, id_c1, 'CREDIT', 3000.00, now() - interval '5 days');

    -- T6: Bob → Alice FS1  ₹1,500  (4 days ago)
    INSERT INTO transfers(from_account_id, to_account_id, from_account_number, to_account_number, amount, created_at)
    VALUES (id_b1, id_a1, 'FS0000000003', 'FS0000000001', 1500.00, now() - interval '4 days')
    RETURNING id INTO t_id;
    INSERT INTO ledger_entries(transfer_id, account_id, entry_type, amount, created_at)
    VALUES (t_id, id_b1, 'DEBIT',  1500.00, now() - interval '4 days'),
           (t_id, id_a1, 'CREDIT', 1500.00, now() - interval '4 days');

    -- T7: Alice FS1 → Alice FS2  ₹2,000  (3 days ago — internal)
    INSERT INTO transfers(from_account_id, to_account_id, from_account_number, to_account_number, amount, created_at)
    VALUES (id_a1, id_a2, 'FS0000000001', 'FS0000000002', 2000.00, now() - interval '3 days')
    RETURNING id INTO t_id;
    INSERT INTO ledger_entries(transfer_id, account_id, entry_type, amount, created_at)
    VALUES (t_id, id_a1, 'DEBIT',  2000.00, now() - interval '3 days'),
           (t_id, id_a2, 'CREDIT', 2000.00, now() - interval '3 days');

    -- T8: Alice FS2 → Bob  ₹750  (2 days ago)
    INSERT INTO transfers(from_account_id, to_account_id, from_account_number, to_account_number, amount, created_at)
    VALUES (id_a2, id_b1, 'FS0000000002', 'FS0000000003', 750.00, now() - interval '2 days')
    RETURNING id INTO t_id;
    INSERT INTO ledger_entries(transfer_id, account_id, entry_type, amount, created_at)
    VALUES (t_id, id_a2, 'DEBIT',  750.00, now() - interval '2 days'),
           (t_id, id_b1, 'CREDIT', 750.00, now() - interval '2 days');

    -- T9: Carol → Bob  ₹1,000  (1 day ago)
    INSERT INTO transfers(from_account_id, to_account_id, from_account_number, to_account_number, amount, created_at)
    VALUES (id_c1, id_b1, 'FS0000000004', 'FS0000000003', 1000.00, now() - interval '1 day')
    RETURNING id INTO t_id;
    INSERT INTO ledger_entries(transfer_id, account_id, entry_type, amount, created_at)
    VALUES (t_id, id_c1, 'DEBIT',  1000.00, now() - interval '1 day'),
           (t_id, id_b1, 'CREDIT', 1000.00, now() - interval '1 day');

    -- Update balances to reflect all seed transfers
    -- FS0000000001: 100000 - 5000 + 1000 + 500 - 3000 + 1500 - 2000 = 93000
    -- FS0000000002:  25000 - 1000 + 2000 - 750 = 25250
    -- FS0000000003:  50000 + 5000 - 2500 - 1500 + 750 + 1000 = 52750
    -- FS0000000004:  10000 + 2500 - 500 + 3000 - 1000 = 14000
    UPDATE accounts SET balance = 93000.00 WHERE account_number = 'FS0000000001';
    UPDATE accounts SET balance = 25250.00 WHERE account_number = 'FS0000000002';
    UPDATE accounts SET balance = 52750.00 WHERE account_number = 'FS0000000003';
    UPDATE accounts SET balance = 14000.00 WHERE account_number = 'FS0000000004';
END;
$$;

-- Seed a few security_events so the audit log has variety (triggers chain them automatically)
INSERT INTO security_events(event_type, severity, details, created_at)
VALUES
  ('LOGIN_SUCCESS',       'LOW',      '{"username":"alice","ip":"10.0.0.1"}',   now() - interval '9 days'),
  ('LOGIN_FAILED',        'MEDIUM',   '{"username":"unknown","attempts":3}',    now() - interval '8 days'),
  ('SUSPICIOUS_TRANSFER', 'HIGH',     '{"from":"FS0000000003","amount":2500}',  now() - interval '7 days 12 hours'),
  ('LOGIN_SUCCESS',       'LOW',      '{"username":"bob","ip":"10.0.0.2"}',     now() - interval '6 days'),
  ('RATE_LIMIT_HIT',      'MEDIUM',   '{"endpoint":"/api/transfers","count":8}',now() - interval '5 days 6 hours'),
  ('LOGIN_SUCCESS',       'LOW',      '{"username":"carol","ip":"10.0.0.3"}',   now() - interval '4 days'),
  ('TOKEN_REFRESH',       'LOW',      '{"username":"alice"}',                   now() - interval '3 days 2 hours'),
  ('LOGIN_FAILED',        'MEDIUM',   '{"username":"alice","attempts":2}',      now() - interval '2 days 8 hours'),
  ('BOLA_ATTEMPT',        'CRITICAL', '{"target_id":2,"actor":"anonymous"}',    now() - interval '1 day 3 hours'),
  ('SQLI_ATTEMPT',        'CRITICAL', '{"payload":"OR 1=1","endpoint":"/lab"}', now() - interval '12 hours');
