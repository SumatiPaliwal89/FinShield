-- 1. Canonical text of an event: a JSON array, so fields can't slide into each other.
CREATE FUNCTION audit_canonical(p_prev TEXT, p_ts TIMESTAMPTZ, p_type TEXT, p_actor TEXT, p_payload JSONB)
RETURNS TEXT
LANGUAGE sql STABLE AS
$$
    SELECT jsonb_build_array(
        p_prev,
        to_char(p_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        p_type,
        p_actor,
        p_payload)::text
$$;

-- 2. The ONLY way to add an audit event.
CREATE FUNCTION fn_append_audit(p_type VARCHAR, p_actor VARCHAR, p_payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prev TEXT;
    v_ts   TIMESTAMPTZ := clock_timestamp();
    v_hash TEXT;
    v_id   BIGINT;
BEGIN
    -- One appender at a time keeps the chain linear (released at commit/rollback).
    PERFORM pg_advisory_xact_lock(727001);

    SELECT hash INTO v_prev FROM audit_events ORDER BY id DESC LIMIT 1;
    IF v_prev IS NULL THEN
        v_prev := repeat('0', 64);            -- genesis
    END IF;

    v_hash := encode(sha256(convert_to(
                 audit_canonical(v_prev, v_ts, p_type, p_actor, p_payload), 'UTF8')), 'hex');

    INSERT INTO audit_events(event_type, actor, payload, prev_hash, hash, created_at)
    VALUES (p_type, p_actor, p_payload, v_prev, v_hash, v_ts)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- 3. Automatic auditing through triggers.
CREATE FUNCTION audit_on_transfer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS
$$
BEGIN
    PERFORM fn_append_audit(
        'TRANSFER_COMPLETED',
        COALESCE('customer:' || app_customer_id()::text, 'system'),
        jsonb_build_object('transfer_id', NEW.id,
                           'from_account_id', NEW.from_account_id,
                           'to_account_id', NEW.to_account_id,
                           'amount', NEW.amount::text));
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_transfer
    AFTER INSERT ON transfers
    FOR EACH ROW EXECUTE FUNCTION audit_on_transfer();

CREATE FUNCTION audit_on_security_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS
$$
BEGIN
    PERFORM fn_append_audit(
        'SECURITY_EVENT',
        COALESCE('customer:' || app_customer_id()::text, 'system'),
        jsonb_build_object('security_event_id', NEW.id,
                           'type', NEW.event_type,
                           'severity', NEW.severity,
                           'details', NEW.details));
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_security_event
    AFTER INSERT ON security_events
    FOR EACH ROW EXECUTE FUNCTION audit_on_security_event();

-- 4. Lock it down: the app can READ the audit log, never write it.
REVOKE INSERT ON audit_events FROM finshield_app;
REVOKE USAGE ON SEQUENCE audit_events_id_seq FROM finshield_app;
REVOKE ALL ON FUNCTION fn_append_audit(VARCHAR, VARCHAR, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_on_transfer() FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_on_security_event() FROM PUBLIC;

-- 5. A login for the auditor role (dev-only synthetic credential).
INSERT INTO users(customer_id, username, password_hash)
VALUES (NULL, 'auditor', crypt('Auditor#Dev2026', gen_salt('bf', 10)));

INSERT INTO user_roles(user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'auditor' AND r.name = 'AUDITOR';