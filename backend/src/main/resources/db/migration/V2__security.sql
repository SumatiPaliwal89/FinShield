-- Lock down defaults
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO finshield_app;

-- Read-only on financial tables (writes go through fn_post_transfer on Day 2)
GRANT SELECT ON customers, accounts, transfers, ledger_entries TO finshield_app;
GRANT SELECT ON users, roles, user_roles TO finshield_app;
GRANT SELECT, INSERT ON idempotency_keys TO finshield_app;

-- Append-only logs: no UPDATE/DELETE/TRUNCATE for the app
GRANT SELECT, INSERT ON audit_events, security_events TO finshield_app;
GRANT USAGE ON SEQUENCE audit_events_id_seq, security_events_id_seq TO finshield_app;

-- Request-scoped identity helper
CREATE FUNCTION app_customer_id() RETURNS BIGINT
LANGUAGE sql STABLE AS
$$ SELECT NULLIF(current_setting('app.customer_id', true), '')::BIGINT $$;
GRANT EXECUTE ON FUNCTION app_customer_id() TO finshield_app;

-- Row-Level Security (not FORCEd: owner/migrations bypass; finshield_app does not)
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_self ON customers FOR SELECT TO finshield_app
    USING (id = app_customer_id());

CREATE POLICY accounts_own ON accounts FOR SELECT TO finshield_app
    USING (customer_id = app_customer_id());

CREATE POLICY transfers_involving_me ON transfers FOR SELECT TO finshield_app
    USING (from_account_id IN (SELECT id FROM accounts)
        OR to_account_id   IN (SELECT id FROM accounts));
-- note: the sub-select is itself RLS-filtered to my accounts

CREATE POLICY ledger_own ON ledger_entries FOR SELECT TO finshield_app
    USING (account_id IN (SELECT id FROM accounts));

-- Audit table: block tampering even by mistake
CREATE FUNCTION audit_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS
$$ BEGIN RAISE EXCEPTION 'audit_events is append-only'; END $$;

CREATE TRIGGER trg_audit_no_row_mutation
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_block_mutation();
CREATE TRIGGER trg_audit_no_truncate
    BEFORE TRUNCATE ON audit_events
    FOR EACH STATEMENT EXECUTE FUNCTION audit_block_mutation();

INSERT INTO roles(name) VALUES ('CUSTOMER'), ('ADMIN'), ('AUDITOR');