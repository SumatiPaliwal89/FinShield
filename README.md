# FinShield

A tamper-evident banking backend built in **Spring Boot + PostgreSQL**, demonstrating defence-in-depth security across seven layers: schema design, row-level security, a SECURITY DEFINER transfer function, JWT authentication, an append-only SHA-256 audit chain, an ethical hacking lab, and an independent CLI verifier.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  HTTP Client                                        │
│    POST /api/auth/login  →  JWT (HS256, 1 h)        │
│    POST /api/transfers   →  Idempotency-Key header  │
│    GET  /api/accounts    →  RLS-filtered response   │
└───────────────────┬─────────────────────────────────┘
                    │ Bearer token
┌───────────────────▼─────────────────────────────────┐
│  Spring Boot (SecurityFilterChain)                  │
│    JWT validation → extract cid claim               │
│    SET LOCAL app.customer_id = <cid>  (RLS context) │
└───────────────────┬─────────────────────────────────┘
                    │ finshield_app role (least privilege)
┌───────────────────▼─────────────────────────────────┐
│  PostgreSQL 16                                      │
│                                                     │
│  Row-Level Security ──► customers / accounts /      │
│    (customer sees       transfers / ledger_entries  │
│     only their rows)                                │
│                                                     │
│  fn_post_transfer ────► idempotency → lock → debit  │
│    (SECURITY DEFINER)   + credit + ledger (atomic)  │
│                                                     │
│  audit_events ────────► SHA-256 hash chain          │
│    (append-only,        written by trigger,         │
│     advisory-locked)    never by the app role       │
└─────────────────────────────────────────────────────┘
                    │ DBA credentials
┌───────────────────▼─────────────────────────────────┐
│  VaultScan CLI  (independent verifier)              │
│    java -jar vaultscan.jar <url> <user> <pw>        │
│    [audit-anchor.json]                              │
└─────────────────────────────────────────────────────┘
```

**Key design decision:** the `finshield_app` role has `SELECT` only on financial tables. All money movement goes through `fn_post_transfer` (SECURITY DEFINER). Even with SQL injection, an attacker cannot `UPDATE accounts SET balance = ...`.

---

## Quick Start

**Prerequisites:** Java 21+, Docker, Node 18+

```bash
# 1. Start Postgres
docker compose up -d

# 2. Run the backend (Flyway applies all migrations automatically)
cd backend && ./mvnw spring-boot:run

# 3. Run the frontend (in a separate terminal)
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

Sign in with any seed account (e.g. Alice / `Alice#Dev2026`). The UI demonstrates every security layer interactively.

**curl quick-check:**

```bash
# Login
curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"Alice#Dev2026"}'

# Use the token (replace <TOKEN>)
curl -s http://localhost:8080/api/accounts \
  -H 'Authorization: Bearer <TOKEN>'

# Transfer
curl -s -X POST http://localhost:8080/api/transfers \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: my-unique-key-001' \
  -d '{"fromAccount":"FS0000000001","toAccount":"FS0000000003","amount":100}'
```

**Seed accounts**

| User | Password | Customer ID | Accounts |
|------|----------|-------------|---------|
| alice | Alice#Dev2026 | 1 | FS0000000001 (₹93,000), FS0000000002 (₹25,250) |
| bob | Bob#Dev2026 | 2 | FS0000000003 (₹52,750) |
| carol | Carol#Dev2026 | 3 | FS0000000004 (₹14,000) |
| auditor | Auditor#Dev2026 | — | — |

---

## Running Tests

```bash
cd backend && ./mvnw test
```

Testcontainers spins up a fresh Postgres 16 instance per suite — no local database required.

| Suite | Tests | What it covers |
|-------|-------|----------------|
| `TransferServiceTest` | 10 | Correctness, idempotency, concurrency, overdraft safety |
| `AuditChainTest` | 11 | Chain integrity, tamper detection, anchor bypass proof |
| `ApiSecurityTest` | 10 | JWT auth, RLS, rate-limit headers, BOLA prevention |
| `EthicalHackingLabTest` | 10 | SQLi exploits + retests, BOLA exploits + retests |
| `QueryPlanTest` | 5 | EXPLAIN ANALYZE for all hot-path queries |
| **Total** | **46** | |

---

## API Reference

All endpoints except `/api/auth/login` and `/actuator/health` require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Returns a JWT. Body: `{"username":"…","password":"…"}` |

### Accounts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/accounts` | List caller's accounts (RLS-filtered) |
| GET | `/api/accounts/{accountNumber}` | Single account; 404 if not yours |
| GET | `/api/ledger` | Caller's ledger entries |

### Transfers
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transfers` | Create transfer. Requires `Idempotency-Key` header. Body: `{"fromAccount","toAccount","amount"}` |
| GET  | `/api/transfers` | List up to 20 recent transfers involving the caller's accounts (RLS-filtered) |

### Audit (AUDITOR role only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/audit/verify` | Walk full chain, re-compute every hash |
| GET | `/api/audit/events` | Last 50 audit events as JSON (for chain visualiser) |
| GET | `/api/audit/anchor-check?id=N&hash=H` | Compare stored checkpoint vs database |

### Error codes from `fn_post_transfer`

| SQLSTATE | Meaning | HTTP |
|----------|---------|------|
| FS001 | Insufficient funds | 422 |
| FS002 | Destination account not found | 422 |
| FS003 | Source account not yours / no context | 403 |
| FS004 | Idempotency key reused with different request | 409 |
| FS005 | Account not active or currency mismatch | 422 |
| FS006 | Invalid request (amount, key length, same account) | 400 |

---

## Security Controls

| Layer | Control |
|-------|---------|
| Database roles | 3 roles: `finshield_owner` (DDL), `finshield_app` (least privilege), auditor |
| Row-Level Security | Customers, accounts, transfers, ledger filtered by `app_customer_id()` session var |
| Transfer atomicity | Single SECURITY DEFINER function — app role cannot UPDATE balances directly |
| Idempotency | SHA-256 of `(from, to, amount)` stored with each key; replays return original result |
| Deadlock prevention | Accounts locked in ascending `id` order inside `fn_post_transfer` |
| JWT | HS256, 1h TTL, `cid` claim binds token to customer |
| Timing-safe auth | Unknown user and wrong password take equal time (constant BCrypt comparison) |
| Username enumeration | Login failures return identical body regardless of whether the user exists |
| Audit chain | SHA-256 hash chain, advisory-locked, written by trigger, never by app role |
| Append-only triggers | UPDATE/DELETE/TRUNCATE on `audit_events` blocked even for table owner |
| External anchor | `audit-anchor.json` stored outside the database; catches tail-deletion and full rewrites |
| JWT tamper resistance | Signed with HS256; `NimbusJwtDecoder` rejects any modification before reaching a controller |
| Security headers | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy on every response |

---

## VaultScan

An independent CLI verifier that re-computes the audit chain without using the Spring application.

```bash
cd vaultscan && mvn package
java -jar target/vaultscan.jar \
  jdbc:postgresql://localhost:5433/finshield \
  finshield_owner owner_dev_pw \
  ../audit-anchor.json
```

See [`docs/vaultscan.md`](docs/vaultscan.md) for full usage, exit codes, and known limits.

---

## Operations

```bash
make backup          # pg_dump + audit anchor snapshot → ops/backups/
make restore DUMP=ops/backups/finshield-*.dump   # restore to finshield_restore + VaultScan check
make zap             # OWASP ZAP baseline scan (requires app running on :8080)
make help            # list all targets
```

See [`ops/explain-analyze.sql`](ops/explain-analyze.sql) for annotated EXPLAIN ANALYZE queries.
See [`.github/workflows/zap.yml`](.github/workflows/zap.yml) for the CI security scan.

---

## Frontend

A React + Vite + Tailwind UI at `frontend/` with eight pages across two sections:

**Banking** (Customer role)

| Page | What it shows |
|------|--------------|
| **Overview** | KPI cards (balance, accounts, transfers, session timer); RLS live switcher (Alice ↔ Bob); recent transfers; ledger volume chart |
| **Accounts** | Account table; click any row to open a drawer with DEBIT/CREDIT ledger history |
| **Transfers** | Transfer form with idempotency replay panel; RLS-filtered transfer history with FROM/TO account numbers |
| **Activity** | Full ledger feed — DEBIT in red, CREDIT in green |

**Security** (all roles; Auditor-only pages marked)

| Page | What it shows |
|------|--------------|
| **Security Center** *(Auditor only)* | Security event log (logins, BOLA attempts, SQLi attempts) |
| **Audit Ledger** *(Auditor only)* | Interactive SHA-256 chain visualiser; one-click chain verification |
| **Threat Lab** | Live exploit/fix demos for OWASP A03 SQL Injection, A01 BOLA, A02 JWT Tampering — real HTTP calls |
| **Session & Access** | JWT header/payload/signature inspector; role permissions matrix; active protections list |

```bash
cd frontend
npm install
npm run dev      # dev server on :5173 (proxies /api → :8080)
npm run build    # production bundle
```

---

## Project Structure

```
finshield/
├── backend/                   Spring Boot app
│   └── src/
│       ├── main/java/com/finshield/
│       │   ├── api/           REST controllers
│       │   ├── account/       AccountQueryService (RLS-scoped queries)
│       │   ├── audit/         AuditVerifier
│       │   ├── lab/           Ethical hacking lab (SQLi, BOLA)
│       │   ├── security/      JWT, RLS context, SecurityConfig
│       │   └── transfer/      TransferService
│       └── resources/db/migration/
│           ├── V1__schema.sql
│           ├── V2__security.sql           RLS policies, roles, append-only triggers
│           ├── V3__seed_synthetic_data.sql
│           ├── V4__transfer_function.sql
│           ├── V5__seed_users.sql
│           ├── V6__audit_chain.sql
│           ├── V7__denorm_account_numbers.sql  Adds from/to account number columns to transfers
│           ├── V8__fix_transfer_function.sql   Updates fn_post_transfer to populate them
│           └── V9__rich_seed_data.sql          9 historical transfers + 10 security events
├── frontend/                  React + Vite + Tailwind UI
│   └── src/
│       ├── api/client.js      Typed fetch wrappers
│       ├── context/           AuthContext (JWT, sessionStorage)
│       └── pages/             Overview, Accounts, Transfers, Activity,
│                              SecurityCenter, AuditLedger, ThreatLab, SessionAccess
├── vaultscan/                 Standalone audit-chain verifier CLI
├── docker/postgres/init/      01-roles.sql (runs at container start)
├── docs/                      audit-design.md, vaultscan.md, evidence-report.md
├── ops/                       backup.sh, restore.sh, explain-analyze.sql
├── zap/                       zap-scan.sh, zap-rules.tsv
├── .github/workflows/zap.yml  CI security scan
├── audit-anchor.json          External chain checkpoint
├── docker-compose.yml
└── Makefile
```
