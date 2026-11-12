# FinShield — Security Evidence Report

**Project:** FinShield  
**Stack:** Spring Boot 3 · PostgreSQL 16 · Testcontainers · VaultScan CLI  
**Test suite:** 46 tests, 0 failures

---

## Day 1 — Schema & Three-Role Model

### What was built
Flyway migration `V1__schema.sql` created the core tables: `customers`, `accounts`, `transfers`, `ledger_entries`, `audit_events`, and `idempotency_keys`.

Three PostgreSQL roles were established with least-privilege grants:

| Role | Purpose | Privileges |
|------|---------|------------|
| `finshield_owner` | DDL / migrations | Owns all objects |
| `finshield_app` | Runtime app role | SELECT on financial tables; EXECUTE on SECURITY DEFINER functions only |
| `finshield_auditor` | Read-only audit access | SELECT on `audit_events` |

The `finshield_app` role has **no UPDATE or DELETE on any table**. This is enforced at the PostgreSQL privilege level — not just application logic.

**Security property:** Even a fully compromised application process cannot directly modify balances. All balance changes must go through `fn_post_transfer`.

---

## Day 2 — Row-Level Security (RLS)

### What was built
`V2__security.sql` enabled RLS on `customers`, `accounts`, `transfers`, and `ledger_entries` with policies that filter every query by the calling customer's identity.

```sql
-- Session variable set by the application JWT filter
CREATE FUNCTION app_customer_id() RETURNS bigint AS $$
  SELECT current_setting('app.customer_id', true)::bigint
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS policy on accounts (same pattern on all four tables)
CREATE POLICY customer_isolation ON accounts
  USING (customer_id = app_customer_id());
```

The `finshield_app` role has `FORCE ROW LEVEL SECURITY` — the policy applies even when the role is table owner (it is not, but as a belt-and-suspenders measure).

The JWT filter calls `SET LOCAL app.customer_id = <cid>` inside the transaction boundary, so the session variable is scoped to the request and cleared automatically on commit/rollback.

**Security property:** Alice cannot read Bob's accounts even if she crafts a SQL query that names Bob's account number — the RLS policy silently excludes the row.

### Evidence — `ApiSecurityTest`
```
fix_B2_eachCallerSeesOnlyTheirOwnProfile — PASS
  Alice: [{"full_name":"Alice Synthetic",...}]
  Bob:   [{"full_name":"Bob Synthetic",...}]
  Carol: [{"full_name":"Carol Synthetic",...}]
```

---

## Day 3 — Idempotent Transfer Function

### What was built
`V4__transfer_function.sql` created `fn_post_transfer(p_idempotency_key, p_from, p_to, p_amount, p_customer_id)` as a `SECURITY DEFINER` function owned by `finshield_owner`.

**Transfer lifecycle inside the function:**
1. Validate inputs (amount > 0, key length, accounts not identical)
2. Check idempotency table — return cached result for a replay
3. Lock both accounts `FOR UPDATE` in ascending `id` order (deadlock prevention)
4. Verify source account belongs to the calling customer (FS003)
5. Verify destination exists and is active, currency matches (FS002, FS005)
6. Verify sufficient funds (FS001)
7. `UPDATE accounts SET balance = balance - amount` on source
8. `UPDATE accounts SET balance = balance + amount` on destination
9. INSERT into `transfers` and two `ledger_entries` (DEBIT + CREDIT)
10. Record idempotency key with the transfer ID

All 10 steps are inside a single function call — atomic by PostgreSQL transaction semantics.

**Security property:** `finshield_app` has `EXECUTE` on this function but cannot `UPDATE accounts` directly. Even with SQL injection the attacker cannot bypass the SECURITY DEFINER boundary.

### Error codes

| SQLSTATE | Condition |
|----------|-----------|
| FS001 | Insufficient funds |
| FS002 | Destination not found |
| FS003 | Source not owned by caller / no RLS context |
| FS004 | Idempotency key reused with different request |
| FS005 | Account inactive or currency mismatch |
| FS006 | Invalid request parameters |

### Evidence — `TransferServiceTest` (10/10)
- `transfer_creditsDestination` — balance increases correctly
- `transfer_idempotencyReturnsSameResult` — second call with same key returns same transfer ID
- `transfer_idempotencyKeyReusedDifferentRequest` — FS004 raised
- `transfer_overdraftRejected` — FS001 raised, balances unchanged
- `transfer_concurrentTransfersDoNotDeadlock` — 20 concurrent threads, 0 deadlocks

---

## Day 4 — SHA-256 Audit Hash Chain

### What was built
`V6__audit_chain.sql` created an append-only audit log with a tamper-evident SHA-256 hash chain.

```sql
-- Each row chains to its predecessor
CREATE TABLE audit_events (
  id         bigserial PRIMARY KEY,
  prev_hash  text NOT NULL,  -- hash of the previous row
  hash       text NOT NULL,  -- sha256(canonical(this row))
  event_type audit_event_type,
  actor      text,
  payload    jsonb,
  created_at timestamptz DEFAULT now()
);
```

The `audit_canonical()` function produces a deterministic string from `(prev_hash, created_at, event_type, actor, payload)` before hashing, so the same data always produces the same hash regardless of serialization order.

A PostgreSQL trigger fires `AFTER INSERT` on `transfers` to write an audit event. `UPDATE`, `DELETE`, and `TRUNCATE` on `audit_events` are blocked by a separate trigger even for the table owner.

Advisory lock `727001` serializes concurrent audit writes, preventing race conditions in the hash chain.

**External anchor:** `audit-anchor.json` stores the head hash outside the database. If an attacker truncates `audit_events` and rebuilds the chain, the anchor detects it.

### Evidence — `AuditChainTest` (11/11)
- `chain_isIntactAfterTransfers` — 5 transfers → 5 events, all hashes valid
- `tamper_detectsModifiedPayload` — editing one row's payload → chain broken at that row
- `tamper_detectsTailDeletion` — deleting the last row → anchor mismatch
- `tamper_detectsFullRewrite` — rebuilding chain from scratch → anchor detects head hash change
- `anchor_bypassProofRequiresCorrectHash` — wrong hash in anchor check → rejected

---

## Day 5 — Ethical Hacking Lab (OWASP A01 + A02 + A03)

### What was built
Three deliberately vulnerable endpoints and their fixed counterparts, exercised by `EthicalHackingLabTest`. The React **Threat Lab** page runs live API calls against each pair so the exploit and the defence are visible side-by-side.

### Vulnerability A1 — SQL Injection

**Vulnerable endpoint:** `GET /api/lab/profile/vuln?name=<input>`

```java
// VULNERABLE — string concatenation, no RLS context, no auth required
String sql = "SELECT full_name, email FROM customers WHERE full_name ILIKE '%" + name + "%'";
return jdbc.queryForList(sql);
```

**Exploit payload:**
```
x' UNION SELECT username, password_hash FROM users--
```

**Result:** The UNION branch bypasses the `customers` table entirely and reads directly from `users` (which has no RLS). The response contains BCrypt hashes starting with `$2a$...`.

**Why RLS doesn't help here:** RLS is scoped per table. The injected UNION branch references `users`, which has no RLS policy. The `app_customer_id()` context is never checked for the second SELECT.

**Fixed endpoint:** `GET /api/lab/profile?name=<input>` (requires Bearer token)

```java
// FIXED — parameterized query, RLS bound to JWT identity
rls.bind(customerId);  // SET LOCAL app.customer_id = <from JWT>
String pattern = "%" + name.replace(...) + "%";
return jdbc.queryForList(
    "SELECT full_name, email FROM customers WHERE full_name ILIKE ? ESCAPE '\\'", pattern);
```

### Vulnerability A02 — JWT Tampering

**What is demonstrated (frontend lab only — no new backend endpoint needed):**

A JWT is three Base64url-encoded sections: `header.payload.signature`. The UI lets a user edit the payload (e.g. change `sub` to `"admin"` and `cid` to `999`) and reconstructs a JWT using the original header and signature with the modified payload. The tampered token is then sent to `GET /api/accounts`.

**Result:** `401 Unauthorized` — the server rejects it because the HMAC-SHA256 signature was computed over the original `header.payload`. Changing any byte in the payload produces a different digest; the stored signature no longer matches.

**Why it cannot succeed:** The signing secret is never exposed to the client. Without the secret an attacker cannot forge a valid signature for a modified payload. Spring Security's `NimbusJwtDecoder` performs this verification before the request reaches any controller — a `JwtValidationException` is thrown and Spring returns 401 automatically.

**Security property:** Claims inside a JWT (identity, roles, customer ID) are signed and cannot be modified client-side. The `cid` claim that drives RLS binding is therefore always trustworthy.

---

### Vulnerability A01 — Broken Object Level Authorization (BOLA)

**Vulnerable endpoint:** `GET /api/lab/customer/{id}/vuln` (requires auth)

```java
// VULNERABLE — attacker controls the customer ID via URL path
public List<Map<String, Object>> profileVuln(long requestedId) {
    rls.bind(requestedId);   // ← attacker sets this to any customer ID
    return jdbc.queryForList("SELECT full_name, email FROM customers WHERE id = ?", requestedId);
}
```

Alice (customer 1) calls `/api/lab/customer/2/vuln` and receives Bob's profile. The JWT is valid but the identity used for RLS comes from the URL, not the token.

**Fixed endpoint:** `GET /api/lab/customer` (ID always from JWT)

```java
// FIXED — identity always from the verified JWT claim
public List<Map<String, Object>> profile(long jwtCustomerId) {
    rls.bind(jwtCustomerId);
    return jdbc.queryForList("SELECT full_name, email FROM customers WHERE id = ?", jwtCustomerId);
}
```

### Evidence — `EthicalHackingLabTest` (10/10)

| Test | Result | Demonstrates |
|------|--------|-------------|
| `exploit_A1_profileVulnAccessibleWithoutToken` | 200 (no token) | Missing auth |
| `exploit_A2_unionInjectionLeaksPasswordHashes` | Response contains `$2` | SQLi via UNION |
| `exploit_B1_bolaAliceReadsBobbsProfile` | "Bob Synthetic" | BOLA |
| `exploit_B2_bolaAliceReadsCarolsProfile` | "Carol Synthetic" | BOLA |
| `fix_A1_safeProfileRequiresAuthentication` | 401 | Auth enforced |
| `fix_A2_injectionPayloadTreatedAsLiteralString` | `[]` (no hashes) | Parameterized query |
| `fix_A3_legitimateSearchReturnsOnlyCallerOwnProfile` | Only Alice's row | RLS + parameterization |
| `fix_B1_safeEndpointAlwaysReturnsCallerProfile` | "Alice Synthetic" | JWT identity enforced |
| `fix_B2_eachCallerSeesOnlyTheirOwnProfile` | Isolated per caller | BOLA prevented |
| `fix_B3_safeCustomerEndpointRequiresAuthentication` | 401 | Auth enforced |

---

## Day 6 — VaultScan CLI + Security Headers + ZAP

### VaultScan

A standalone fat jar (`vaultscan.jar`) that re-computes the audit chain independently of the Spring application. Uses only the PostgreSQL JDBC driver — zero Spring dependency.

**Algorithm:**
1. Connect as `finshield_owner` (DBA credentials, never `finshield_app`)
2. Read all `audit_events ORDER BY id`
3. For each row: call `audit_canonical()` via the database function, compute `sha256(canonical)` in Java, compare to stored `hash`
4. Verify each row's `prev_hash` matches the previous row's `hash`
5. If an `anchor.json` is supplied, compare stored head hash vs `anchor.headHash`

**Exit codes:**
- `0` — chain intact (and anchor matches if supplied)
- `1` — chain broken or anchor mismatch
- `2` — usage error or connection failure

**Known limit:** Canonicalization uses the database's own `audit_canonical()` function. True independence would require re-implementing JSONB serialization in Java. This is documented in `docs/vaultscan.md`.

### Security Headers

Added to `SecurityConfig.java` via Spring Security's headers DSL:

| Header | Value | Threat mitigated |
|--------|-------|-----------------|
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Content-Security-Policy` | `default-src 'none'` | XSS (API-only, no browser resources) |
| `Referrer-Policy` | `no-referrer` | Information leakage in Referer header |

Headers are applied to every response via Spring's filter chain.

### Evidence — `ApiSecurityTest.securityHeadersArePresentOnEveryResponse` (PASS)

```
X-Content-Type-Options: nosniff         ✓
X-Frame-Options: DENY                   ✓
Content-Security-Policy: default-src 'none'  ✓
Referrer-Policy: no-referrer            ✓
```

### OWASP ZAP Baseline Scan

`zap/zap-scan.sh` runs the ZAP baseline scan via Docker against the running application.

`zap/zap-rules.tsv` suppresses four informational false positives that do not apply to a JWT-based API:

| Rule | Suppressed because |
|------|--------------------|
| 10021 X-Content-Type-Options | Spring Security sets `nosniff` — ZAP misses it |
| 10035 HSTS | HTTP-only dev environment; enforced at load balancer in prod |
| 10054 Cookie SameSite | No cookies; auth is Bearer token only |
| 10096 Timestamp disclosure | Timestamps in audit payloads are intentional data |

A GitHub Actions workflow (`.github/workflows/zap.yml`) runs the scan in CI: starts Postgres, builds the jar, waits for the health endpoint, runs ZAP, uploads the HTML report as an artifact.

---

## Day 7 — Query Plans, Backup/Restore, and Operations

### EXPLAIN ANALYZE — Hot-Path Queries

Five production query plans captured from `QueryPlanTest` (Testcontainers, PostgreSQL 16):

#### 1. Account lookup by `account_number`
```
Query: SELECT * FROM accounts WHERE account_number = 'FS0000000001'
Plan:  Index Scan using accounts_account_number_key on accounts
       (cost=0.14..8.16 rows=1 width=72)
       Index Cond: (account_number = 'FS0000000001')
```
**Index:** Unique constraint on `account_number` — O(log n) lookup, single row.

#### 2. Accounts for a customer (RLS filter path)
```
Query: SELECT * FROM accounts WHERE customer_id = 1
Plan:  Bitmap Index Scan on idx_accounts_customer
       (cost=0.00..4.21 rows=2 width=72)
       Index Cond: (customer_id = 1)
```
**Index:** `idx_accounts_customer` — this is the index hit on every authenticated API call after `rls.bind()`.

#### 3. Ledger entries for a customer
```
Query: SELECT le.id, le.entry_type, le.amount, le.created_at, t.id AS transfer_id
       FROM ledger_entries le JOIN transfers t ON t.id = le.transfer_id
       WHERE le.account_id IN (SELECT id FROM accounts WHERE customer_id = 1)
       ORDER BY le.created_at DESC
Plan:  Nested Loop
         Hash Join
           Hash  (cost=... rows=1)
             → Bitmap Index Scan on idx_accounts_customer
           Seq Scan on ledger_entries  [small test dataset]
         Index Only Scan on transfers_pkey
```
**Production behavior:** `idx_ledger_account` on `ledger_entries.account_id` eliminates the Seq Scan at scale. At 4-row test volume the planner correctly prefers Seq Scan.

#### 4. Audit chain walk
```
Query: SELECT id, prev_hash, hash, audit_canonical(...) AS canonical
       FROM audit_events ORDER BY id
Plan:  Sort  (cost=...)
         Sort Key: id
       → Seq Scan on audit_events  [5-row dataset]
```
**Production behavior:** At scale, `ORDER BY id` on the primary key column uses an Index Scan (no Sort node). The PK index already provides sorted order. For large chains, `fetch_size=1000` in the JDBC cursor prevents full-table buffering.

#### 5. Transfer locking SELECT
```
Query: SELECT 1 FROM accounts WHERE account_number IN ('FS0000000001', 'FS0000000003')
       ORDER BY id FOR UPDATE
Plan:  LockRows
         Sort
           Bitmap Index Scan on accounts_account_number_key
           BitmapOr
             Bitmap Index Scan (account = FS0000000001)
             Bitmap Index Scan (account = FS0000000003)
```
**Deadlock prevention:** Locking in `ORDER BY id` (ascending) guarantees every concurrent transfer acquires locks in the same order, eliminating the classic A→B / B→A deadlock.

### Backup and Restore

`ops/backup.sh`:
- `pg_dump --format=custom` → `ops/backups/finshield-YYYYMMDD-HHMMSS.dump`
- Verifies dump with `pg_restore --list`
- Calls `/api/audit/verify` to snapshot the audit chain head into `anchor-YYYYMMDD-HHMMSS.json` alongside the dump

`ops/restore.sh`:
- Restores into `finshield_restore` (not the live database)
- Prints row counts for sanity check
- Runs VaultScan against the restored database if the jar is present

This two-step approach (restore then verify before promoting) prevents a corrupted backup from silently replacing the live database.

### Makefile

```
make up              docker compose up -d
make down            docker compose down
make test            cd backend && mvn test
make backup          ops/backup.sh
make restore DUMP=…  ops/restore.sh <dump>
make vaultscan-build cd vaultscan && mvn package
make vaultscan       java -jar vaultscan/target/vaultscan.jar …
make zap             zap/zap-scan.sh
make help            list all targets
```

---

## Test Suite Summary

| Suite | Tests | Pass | Fail |
|-------|-------|------|------|
| `TransferServiceTest` | 10 | 10 | 0 |
| `AuditChainTest` | 11 | 11 | 0 |
| `ApiSecurityTest` | 10 | 10 | 0 |
| `EthicalHackingLabTest` | 10 | 10 | 0 |
| `QueryPlanTest` | 5 | 5 | 0 |
| **Total** | **46** | **46** | **0** |

All tests run against a real PostgreSQL 16 instance via Testcontainers. No mocks are used for database interactions.

---

## Security Controls Matrix

| Control | Layer | Evidence |
|---------|-------|---------|
| Least-privilege roles | DB | `V2__security.sql` grants; `finshield_app` has no UPDATE/DELETE |
| Row-Level Security | DB | `V2__security.sql` RLS policies; `EthicalHackingLabTest.fix_B2` |
| SECURITY DEFINER transfer function | DB | `V4__transfer_function.sql`; `TransferServiceTest` |
| Idempotency | DB+App | `idempotency_keys` table; `TransferServiceTest.transfer_idempotencyReturnsSameResult` |
| Deadlock prevention | DB | `fn_post_transfer` ORDER BY id lock; `transfer_concurrentTransfersDoNotDeadlock` |
| SHA-256 hash chain | DB | `V6__audit_chain.sql`; `AuditChainTest` |
| Append-only triggers | DB | `V6__audit_chain.sql` trigger; `AuditChainTest.tamper_*` |
| External anchor | App+File | `audit-anchor.json`; `AuditChainTest.tamper_detectsFullRewrite` |
| JWT authentication | App | `JwtFilter.java`; `ApiSecurityTest` |
| Timing-safe auth | App | `AuthService.java` constant-time comparison; `ApiSecurityTest.login_wrongPassword_401` |
| SQL injection prevention | App | Parameterized queries; `EthicalHackingLabTest.fix_A2` |
| JWT tamper resistance | App | HMAC-SHA256 signature; `NimbusJwtDecoder`; Security Lab A02 demo |
| BOLA prevention | App | JWT-only identity; `EthicalHackingLabTest.fix_B1`, `fix_B2` |
| Security headers | App | `SecurityConfig.java`; `ApiSecurityTest.securityHeadersArePresentOnEveryResponse` |
| Independent verifier | CLI | `vaultscan.jar`; `docs/vaultscan.md` |
| ZAP baseline scan | CI | `.github/workflows/zap.yml`; `zap/zap-rules.tsv` |
| Backup + chain verification | Ops | `ops/backup.sh`, `ops/restore.sh` |
