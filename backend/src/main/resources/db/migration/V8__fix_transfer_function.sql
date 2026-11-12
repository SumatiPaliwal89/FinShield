-- Replace fn_post_transfer to populate the new from/to account_number columns
CREATE OR REPLACE FUNCTION fn_post_transfer(
    p_idem_key     VARCHAR,
    p_from_account VARCHAR,
    p_to_account   VARCHAR,
    p_amount       NUMERIC
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_customer BIGINT := app_customer_id();
    v_hash     CHAR(64);
    v_existing idempotency_keys%ROWTYPE;
    v_from     accounts%ROWTYPE;
    v_to       accounts%ROWTYPE;
    v_transfer UUID;
BEGIN
    IF v_customer IS NULL THEN
        RAISE EXCEPTION 'no customer context' USING ERRCODE = 'FS003';
    END IF;
    IF p_idem_key IS NULL OR length(p_idem_key) = 0 OR length(p_idem_key) > 64
       OR p_from_account IS NULL OR p_to_account IS NULL OR p_amount IS NULL
       OR p_amount <= 0 OR p_amount <> round(p_amount, 4)
       OR p_from_account = p_to_account THEN
        RAISE EXCEPTION 'invalid transfer request' USING ERRCODE = 'FS006';
    END IF;

    v_hash := encode(sha256(convert_to(
        p_from_account || '|' || p_to_account || '|' || (p_amount::numeric(19,4))::text,
        'UTF8')), 'hex');

    INSERT INTO idempotency_keys(customer_id, idem_key, request_hash)
    VALUES (v_customer, p_idem_key, v_hash)
    ON CONFLICT (customer_id, idem_key) DO NOTHING;

    IF NOT FOUND THEN
        SELECT * INTO v_existing FROM idempotency_keys
         WHERE customer_id = v_customer AND idem_key = p_idem_key;
        IF v_existing.request_hash <> v_hash THEN
            RAISE EXCEPTION 'idempotency key reused with a different request'
                USING ERRCODE = 'FS004';
        END IF;
        RETURN v_existing.transfer_id;
    END IF;

    PERFORM 1 FROM accounts
     WHERE account_number IN (p_from_account, p_to_account)
     ORDER BY id FOR UPDATE;

    SELECT * INTO v_from FROM accounts WHERE account_number = p_from_account;
    SELECT * INTO v_to   FROM accounts WHERE account_number = p_to_account;

    IF v_from.id IS NULL OR v_from.customer_id <> v_customer THEN
        RAISE EXCEPTION 'source account not found or not yours' USING ERRCODE = 'FS003';
    END IF;
    IF v_to.id IS NULL THEN
        RAISE EXCEPTION 'destination account not found' USING ERRCODE = 'FS002';
    END IF;
    IF v_from.status <> 'ACTIVE' OR v_to.status <> 'ACTIVE'
       OR v_from.currency <> v_to.currency THEN
        RAISE EXCEPTION 'account not active or currency mismatch' USING ERRCODE = 'FS005';
    END IF;
    IF v_from.balance < p_amount THEN
        RAISE EXCEPTION 'insufficient funds' USING ERRCODE = 'FS001';
    END IF;

    INSERT INTO transfers(from_account_id, to_account_id, from_account_number, to_account_number, amount)
    VALUES (v_from.id, v_to.id, p_from_account, p_to_account, p_amount)
    RETURNING id INTO v_transfer;

    INSERT INTO ledger_entries(transfer_id, account_id, entry_type, amount)
    VALUES (v_transfer, v_from.id, 'DEBIT',  p_amount),
           (v_transfer, v_to.id,   'CREDIT', p_amount);

    UPDATE accounts SET balance = balance - p_amount WHERE id = v_from.id;
    UPDATE accounts SET balance = balance + p_amount WHERE id = v_to.id;

    UPDATE idempotency_keys SET transfer_id = v_transfer
     WHERE customer_id = v_customer AND idem_key = p_idem_key;

    RETURN v_transfer;
END;
$$;
