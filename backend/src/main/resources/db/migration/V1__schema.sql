CREATE TABLE customers (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name   VARCHAR(120) NOT NULL,
    email       VARCHAR(254) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id    SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name  VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE users (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id    BIGINT REFERENCES customers(id),
    username       VARCHAR(60)  NOT NULL UNIQUE,
    password_hash  VARCHAR(100) NOT NULL,
    enabled        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
    user_id  BIGINT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id  SMALLINT NOT NULL REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE accounts (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id     BIGINT        NOT NULL REFERENCES customers(id),
    account_number  VARCHAR(20)   NOT NULL UNIQUE,
    currency        CHAR(3)       NOT NULL DEFAULT 'INR',
    balance         NUMERIC(19,4) NOT NULL DEFAULT 0 CONSTRAINT chk_balance_non_negative CHECK (balance >= 0),
    status          VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','FROZEN','CLOSED')),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_customer ON accounts(customer_id);

CREATE TABLE transfers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_account_id  BIGINT        NOT NULL REFERENCES accounts(id),
    to_account_id    BIGINT        NOT NULL REFERENCES accounts(id),
    amount           NUMERIC(19,4) NOT NULL CHECK (amount > 0),
    status           VARCHAR(10)   NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED','FAILED')),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_distinct_accounts CHECK (from_account_id <> to_account_id)
);
CREATE INDEX idx_transfers_from ON transfers(from_account_id, created_at DESC);
CREATE INDEX idx_transfers_to   ON transfers(to_account_id, created_at DESC);

CREATE TABLE ledger_entries (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transfer_id  UUID          NOT NULL REFERENCES transfers(id),
    account_id   BIGINT        NOT NULL REFERENCES accounts(id),
    entry_type   VARCHAR(6)    NOT NULL CHECK (entry_type IN ('DEBIT','CREDIT')),
    amount       NUMERIC(19,4) NOT NULL CHECK (amount > 0),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_one_entry_per_side UNIQUE (transfer_id, entry_type)
);
CREATE INDEX idx_ledger_account ON ledger_entries(account_id, created_at DESC);

CREATE TABLE idempotency_keys (
    customer_id   BIGINT      NOT NULL REFERENCES customers(id),
    idem_key      VARCHAR(64) NOT NULL,
    request_hash  CHAR(64)    NOT NULL,
    transfer_id   UUID REFERENCES transfers(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (customer_id, idem_key)
);

CREATE TABLE audit_events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type  VARCHAR(50) NOT NULL,
    actor       VARCHAR(60) NOT NULL,
    payload     JSONB       NOT NULL,
    prev_hash   CHAR(64)    NOT NULL,
    hash        CHAR(64)    NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE security_events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type  VARCHAR(50) NOT NULL,
    severity    VARCHAR(10) NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    details     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);