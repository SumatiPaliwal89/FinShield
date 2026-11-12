# FinShield — Demo Walkthrough

**Audience:** Faculty / Evaluators  
**Duration:** 20–25 minutes  
**Prerequisites:** Backend running on `:8080`, frontend running on `:5173`

---

## Before You Start — Checklist

```bash
# Terminal 1 — Postgres
docker compose up -d

# Terminal 2 — Spring Boot (wait for "Started FinshieldApplication")
cd backend && ./mvnw spring-boot:run

# Terminal 3 — React UI
cd frontend && npm run dev
```

Open `http://localhost:5173` in a browser. Keep Terminal 2 visible — you will show Spring Boot logs during the transfer demo.

---

## Opening Statement (1 min)

> "FinShield is a secure banking backend built over seven days. The goal was not just to build CRUD endpoints, but to demonstrate how security should work at every layer of a real system — from the database schema up to the HTTP response headers.
>
> Today I will show you seven security layers in order, and for each one I will prove it works — not with a slide, but with a live call."

---

## Act 1 — Authentication & JWT (3 min)

### Step 1 · Login as Alice

1. Open the login page at `http://localhost:5173`
2. Point out the **left panel** — four security features listed with the layers they operate at
3. Click the **Alice** quick-login button — credentials fill automatically
4. Click **Sign in**

**What to say:**
> "Watch the right side after I log in."

**What happens:** The JWT decoded panel animates in below the form, showing:
```
sub   alice
cid   1
roles [USER]
iat   1234567890  (10:30:00)
exp   1234568790  (10:45:00)
```

**What to explain:**
> "This is the actual payload of the JWT the backend just issued — decoded in the browser using `atob()` on the base64 segment. Notice the `cid` claim — that is Alice's customer ID, baked into the signed token. Every subsequent request carries this claim, and the backend extracts it to set the PostgreSQL session variable that drives Row-Level Security. The token expires in 15 minutes — HS256 signed with a 32-byte secret."

**Key point:** Identity flows from login → JWT → `cid` claim → `SET LOCAL app.customer_id`. It is never accepted from a URL parameter or request body.

---

## Act 2 — Row-Level Security (4 min)

### Step 2 · Navigate to Dashboard

After login auto-redirects, you are on the Dashboard.

**What to show:** Alice's accounts — `FS0000000001` (₹1,00,000) and `FS0000000002` (₹25,000).

**What to say:**
> "Alice has two accounts. The backend query is simply `SELECT * FROM accounts` — no WHERE clause filtering by customer. But she only sees her own two rows. Why?"

Point to the blue banner:

> "PostgreSQL Row-Level Security. When Alice's JWT is validated, the filter sets `app.customer_id = 1` as a session-local variable. A policy on the `accounts` table adds `WHERE customer_id = app_customer_id()` to every SELECT automatically — at the database engine level, before any result reaches Java."

### Step 3 · Switch to Bob

Click the **Bob** button in the RLS Demo banner.

**What happens:** Accounts panel instantly changes to show only `FS0000000003` (₹50,000). Ledger changes too.

**What to say:**
> "I did not log out. I fetched Bob's token silently and re-queried the same endpoint. The same SQL, the same Java code — but now the database sees `app.customer_id = 2` and returns only Bob's row. Neither Alice nor Bob can ever see each other's accounts, even with direct SQL access as the application role."

### Step 4 · Switch to Carol, then back to Alice

Click **Carol** — only her one account at ₹10,000 is visible.  
Click **Alice** — both her accounts return.

**What to say:**
> "Three users, same query, completely isolated results. This is enforced at the database layer — not in the application layer where it could be bypassed."

**Key point to land:** Even if a developer forgets to add a WHERE clause, RLS enforces isolation. It is a defence against developer mistakes.

---

## Act 3 — SECURITY DEFINER Transfer Function (4 min)

### Step 5 · Navigate to Transfer

Click **Transfer** in the sidebar.

**What to explain before demonstrating:**
> "In most banking apps, the application role has UPDATE permission on the accounts table. This means any SQL injection, any compromised service account, any coding mistake can directly modify balances. FinShield removes that permission entirely. The `finshield_app` role cannot UPDATE accounts at all. The only way to move money is through a PostgreSQL function called `fn_post_transfer`, which runs as the database owner — a SECURITY DEFINER function."

### Step 6 · Make a transfer

1. Select `FS0000000001` (Alice's main account) as **From**
2. Enter `FS0000000003` (Bob's account) as **To**
3. Enter `500` as **Amount**
4. Note the auto-generated UUID idempotency key
5. Click **Send Transfer**

**What happens:** Success panel shows the transfer ID and both updated balances.

**What to say:**
> "Inside the database, that one function call did ten things atomically: validated the amount, checked idempotency, locked both accounts in ascending ID order to prevent deadlocks, verified Alice owns the source account, checked Bob's account exists and is active, confirmed sufficient funds, debited Alice, credited Bob, wrote two ledger entries, and recorded the idempotency key — all in a single transaction that either completely succeeds or completely rolls back."

### Step 7 · Demonstrate idempotency

A yellow **"Send Duplicate Request"** panel has appeared with the same key.

Click **Send Duplicate Request**.

**What happens:** The result shows "Idempotent Replay — same idempotency key → same result returned."

**What to say:**
> "I sent the identical HTTP request twice — same key, same accounts, same amount. The backend detected the replay and returned the original transfer ID. No second transaction was created, no double-spend. This is essential for any real payment system where network timeouts can cause clients to retry."

### Step 8 · Try an overdraft (optional, 30 sec)

Change amount to `9,99,999` and try to transfer.

**What happens:** `422 Unprocessable Entity` with error code `FS001` — Insufficient funds.

**What to say:**
> "The database enforces the balance constraint — not the application. FS001 through FS006 are custom SQLSTATE error codes raised by the function and translated to HTTP status codes by the exception handler."

---

## Act 4 — SHA-256 Audit Chain (3 min)

### Step 9 · Navigate to Audit Chain

Click **Audit Chain** in the sidebar.

**What to say:**
> "Every transfer writes an event to the audit log. But a simple INSERT log can be edited — a DBA could delete a row or change an amount. FinShield makes this detectable using a SHA-256 hash chain, similar in structure to a blockchain."

**What to show:** The horizontal chain of blocks. Point out:
- Each block shows an event ID, event type (TRANSFER), actor, truncated hash
- The rightmost block glows blue — it is the current chain head
- Click any block to expand and see the full payload (from account, to account, amount)

**What to explain:**
> "Each block's hash is computed from its own content — the timestamp, actor, payload — AND the previous block's hash. If anyone modifies row #3, its hash changes, which breaks row #4's `prev_hash` check, which breaks every subsequent row. The entire tail of the chain is invalidated."

### Step 10 · Verify the chain

Click **Verify Chain**.

**What happens:** Green banner appears — "Chain Intact — N events verified."

**What to say:**
> "The backend just re-computed every SHA-256 hash from scratch and confirmed the chain is unbroken. This runs outside the app role using the DBA credentials — the same logic as VaultScan, the independent CLI verifier."

**What to say about append-only:**
> "Even if someone gained DBA access and tried to DELETE from `audit_events`, a PostgreSQL trigger blocks it — even for the table owner. And we store an external anchor — the head hash saved outside the database — so a full table rewrite is also detectable."

---

## Act 5 — Ethical Hacking Laboratory (6 min)

### Navigate to Security Lab

Click **Security Lab** in the sidebar.

**What to say:**
> "Now I am going to attack this system. These are real endpoints, real HTTP calls, real responses — not simulations."

Watch the green status bar confirm "Lab ready — Alice's token acquired."

---

### Attack 1 — SQL Injection (OWASP A03)

**Step 11 · Execute the attack**

Point to the left red panel. Read out the endpoint: `GET /api/lab/profile/vuln?name=…`

**What to say:**
> "This endpoint was written by a developer who thought it was safe to make public — just a name search. They forgot authentication. And they concatenated user input directly into the SQL string."

Show the payload:
```
x' UNION SELECT username, password_hash FROM users--
```

**What to say:**
> "This is a classic UNION injection. The single quote closes Alice's string, the UNION attaches a second SELECT against the users table — which is where the application stores login credentials — and the double-dash comments out the rest of the query."

Click **Execute Attack**.

**What happens:** Terminal output shows rows containing `$2a$10$...` — BCrypt password hashes.

**What to say:**
> "Those are BCrypt hashes. An attacker now has every user's password hash and can crack them offline. Notice that Row-Level Security did NOT protect us here — RLS is scoped per table. The UNION branch targeted the `users` table, which has no RLS policy. The `customers` table was completely bypassed."

**Step 12 · Test the defense**

Click **Test Defense** on the right green panel.

**What happens:** Terminal shows `[] — No password hashes in response.`

**What to say:**
> "Same payload. The fixed endpoint uses a parameterized query — the `?` placeholder — and also requires a Bearer token. The injection payload is passed as a literal string to `ILIKE`. PostgreSQL never interprets it as SQL. The result is empty because no customer's name literally contains the UNION keyword."

---

### Attack 2 — Broken Object Level Authorization (OWASP A01)

**Step 13 · Execute the BOLA attack**

The target selector shows Bob (ID=2). Point to it.

**What to say:**
> "Alice is logged in. She has a valid JWT. But this endpoint accepts the customer ID from the URL path — `/api/lab/customer/2/vuln`. Alice can put any number there."

Point to the vulnerable code snippet:
```java
rls.bind(requestedId)  // ← URL parameter, not JWT
```

**What to say:**
> "The developer called `rls.bind()` with the URL value. Alice's JWT proves she is authenticated, but the RLS context is set to whoever she claims to be in the URL. Authentication and authorization are two different things — this is a common confusion."

Click **Execute BOLA**.

**What happens:** Terminal shows "BOLA SUCCESSFUL — Alice sees: Bob Synthetic."

**What to say:**
> "Alice just read Bob's profile using her own valid token. This is BOLA — Broken Object Level Authorization. OWASP's number one vulnerability for the last five years."

**Step 14 · Test the defense**

Click **Test Defense**.

**What happens:** Terminal shows "Alice Synthetic — Alice can only see herself."

**What to say:**
> "The fix is one line: `rls.bind(jwtCustomerId)` instead of `rls.bind(requestedId)`. The endpoint has no ID parameter at all. The identity always comes from the cryptographically signed JWT claim, which Alice cannot modify without invalidating the signature."

---

## Act 6 — Security Headers (1 min)

This is a brief but important point. Show it verbally while the Lab page is still open.

**What to say:**
> "Every HTTP response from this application carries four security headers configured in Spring Security. `X-Frame-Options: DENY` — no iframe embedding, prevents clickjacking. `X-Content-Type-Options: nosniff` — browser cannot MIME-sniff response content. `Content-Security-Policy: default-src 'none'` — this is an API, no browser resources should load from it at all. `Referrer-Policy: no-referrer` — prevents leaking the URL in outbound requests.
>
> These are tested in `ApiSecurityTest.securityHeadersArePresentOnEveryResponse` and scanned by OWASP ZAP in CI."

---

## Act 7 — VaultScan & Ops (1 min, terminal)

Switch to Terminal 2 (or open a new one). Run:

```bash
cd vaultscan && mvn package -q
java -jar target/vaultscan.jar \
  jdbc:postgresql://localhost:5433/finshield \
  finshield_owner owner_dev_pw \
  ../audit-anchor.json
```

**What to say:**
> "VaultScan is a completely standalone Java program — no Spring, no application context, just the PostgreSQL JDBC driver. It reconnects directly as the database owner, re-reads every audit event, recomputes every SHA-256 hash, and compares the chain head against the external anchor file. Exit code 0 means intact. This is what you would run after a restore to verify the database was not tampered with before promoting it to production."

If there are events from the demo: output will show something like:

```
[VaultScan] Checking 7 events...
[VaultScan] Chain INTACT — head #7 (a3f2b1...)
[VaultScan] Anchor matches ✓
```

---

## Closing — Test Suite (1 min)

Switch to Terminal 2 or run:

```bash
cd backend && ./mvnw test 2>&1 | tail -5
```

**Expected output:**
```
[INFO] Tests run: 46, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

**What to say:**
> "46 tests across 5 suites. Every one of them runs against a real PostgreSQL 16 instance spun up by Testcontainers — no mocks, no in-memory database. The test suite covers correct transfer behaviour, idempotency, concurrent transfers without deadlock, the full audit chain including tamper detection, all API security controls, and the EXPLAIN ANALYZE query plans for the five hot-path queries."

---

## Anticipated Questions

**Q: Why not use an ORM like Hibernate?**
> "By design. JdbcTemplate gives direct control over every SQL statement. ORM abstractions can silently bypass RLS if they issue queries outside the transaction boundary or use a different connection. With JDBC we know exactly when each statement runs and in which transaction."

**Q: How does RLS actually work — can the app role bypass it?**
> "No. `FORCE ROW LEVEL SECURITY` is set on each table, which applies the policy even to the table owner. The app role has `SET SESSION AUTHORIZATION` revoked, so it cannot impersonate another role. The only way to bypass RLS would be to use the DBA credentials — which are never held by the application at runtime."

**Q: What if the JWT secret is compromised?**
> "An attacker could forge tokens with any `cid` claim and bypass authentication. The mitigation is key rotation — replace the secret and restart the app, invalidating all existing tokens. For production this would use asymmetric RS256 keys with a JWKS endpoint, allowing rotation without downtime."

**Q: Is the hash chain really independent if VaultScan uses `audit_canonical()` from the same database?**
> "Partially. VaultScan recomputes SHA-256 in Java independently, but it calls the database's own `audit_canonical()` function for the canonicalization step. True independence would require re-implementing JSONB serialization in Java. This is documented as a known limitation in `docs/vaultscan.md`. The anchor mechanism catches the more dangerous attacks — full table rewrite and tail deletion — even with this dependency."

**Q: Where would this go next in production?**
> "HTTPS with TLS 1.3, RS256 asymmetric JWT, pgBouncer connection pooling with per-user pools to maintain RLS context isolation, WAL-based logical replication for the audit log to a write-only replica, and replacing the advisory lock with a dedicated audit sequencer service for higher throughput."

---

## Demo Recovery — If Something Goes Wrong

| Problem | Fix |
|---------|-----|
| Backend not starting | Check `docker compose up -d` ran; look for port 5433 conflict |
| `401` on all endpoints | Token expired (15 min TTL) — log out and log in again |
| Security Lab shows "Init failed" | Backend not running — check Terminal 2 |
| Audit Chain shows empty | No transfers yet — make one on Transfer page, then refresh |
| VaultScan "connection refused" | Docker DB not running or wrong port — check `docker compose ps` |
| Transfer fails with FS003 | RLS user mismatch — use the account that belongs to the logged-in user |

---

## Seven Layers — Quick Reference Card

| # | Layer | Mechanism | Proven by |
|---|-------|-----------|-----------|
| 1 | Schema & roles | 3 PostgreSQL roles, least-privilege grants | `V1`, `V2` migrations |
| 2 | Row-Level Security | `app.customer_id` session variable + policies | Dashboard RLS switcher |
| 3 | SECURITY DEFINER | `fn_post_transfer` — app cannot UPDATE directly | Transfer page |
| 4 | SHA-256 audit chain | Hash chain + advisory lock + append-only triggers | Audit Chain page |
| 5 | JWT authentication | HS256, 15-min TTL, `cid` claim | Login JWT panel |
| 6 | SQLi & BOLA defence | Parameterized queries, JWT-only identity | Security Lab |
| 7 | Security headers + ZAP | Spring Security headers DSL, CI scan | `ApiSecurityTest` |
