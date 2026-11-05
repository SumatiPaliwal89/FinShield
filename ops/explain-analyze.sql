-- ops/explain-analyze.sql
-- EXPLAIN ANALYZE for the four hot paths in FinShield.
-- Run against a database with realistic data volumes.
-- Connect as: psql -h localhost -p 5433 -U finshield_owner finshield

-- ── 0. Config: show actual plans ─────────────────────────────────────────────
SET enable_seqscan = on;   -- leave planner free; production volumes pick indexes

-- ── 1. Account lookup by account_number ──────────────────────────────────────
-- Hot path: GET /api/accounts/{accountNumber}
-- Expected: Index Scan on accounts_account_number_key (unique index)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, customer_id, account_number, currency, balance, status, created_at
FROM   accounts
WHERE  account_number = 'FS0000000001';

-- ── 2. All accounts for a customer (RLS filter) ───────────────────────────────
-- Hot path: GET /api/accounts  (after rls.bind sets app.customer_id)
-- Expected: Index Scan on idx_accounts_customer
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, account_number, currency, balance, status
FROM   accounts
WHERE  customer_id = 1;

-- ── 3. Ledger entries for a customer ─────────────────────────────────────────
-- Hot path: GET /api/ledger
-- Expected: Index Scan on idx_ledger_account; Nested Loop or Hash Join with transfers
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT le.id, le.entry_type, le.amount, le.created_at,
       t.id AS transfer_id
FROM   ledger_entries le
JOIN   transfers      t ON t.id = le.transfer_id
WHERE  le.account_id IN (
    SELECT id FROM accounts WHERE customer_id = 1
)
ORDER  BY le.created_at DESC;

-- ── 4. Audit chain walk (full table, ordered by id) ───────────────────────────
-- Used by: AuditVerifier, VaultScan
-- Expected: Index Scan on audit_events_pkey (primary key) for ordered scan;
--           Seq Scan on small tables (optimizer decides).
-- Set fetch_size=1000 in Java to stream rather than buffer.
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, prev_hash, hash,
       audit_canonical(prev_hash::text, created_at,
                       event_type::text, actor::text, payload) AS canonical
FROM   audit_events
ORDER  BY id;

-- ── 5. Transfer function (the money-movement hot path) ────────────────────────
-- fn_post_transfer is a PL/pgSQL function; EXPLAIN the internal SELECT that
-- locks both accounts (step 3 of the function).
-- Expected: Index Scan using accounts_account_number_key; Bitmap OR for two values.
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 1
FROM   accounts
WHERE  account_number IN ('FS0000000001', 'FS0000000003')
ORDER  BY id
FOR    UPDATE;
