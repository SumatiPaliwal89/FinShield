# Prompt for Claude — FinShield Case Study Presentation

Paste the entire content below as your message to Claude.

---

## PROMPT START

Create a **professional, well-structured PowerPoint presentation** as a `.pptx` file for the following case study. This is a university/college project presentation aimed at faculty evaluators. The tone should be technical but clear — confident, not casual.

---

### Project Overview

**Project Name:** FinShield  
**Tagline:** Defence in depth, layer by layer.  
**Type:** Secure Banking Backend — 7-day build  
**Stack:** Spring Boot 3 · PostgreSQL 16 · Java 21 · Testcontainers · React + Vite (frontend demo UI)  
**Test suite:** 46 tests, 0 failures, all running against real PostgreSQL via Testcontainers (no mocks)

---

### What Was Built

A production-grade banking backend that demonstrates seven security layers, each enforced at a different level of the stack. The core thesis is **defence in depth** — if one layer is bypassed, the next one still holds.

The system handles:
- User authentication (JWT HS256, 15-min TTL, BCrypt passwords)
- Multi-account management with Row-Level Security
- Atomic money transfers via a SECURITY DEFINER PostgreSQL function
- A tamper-evident SHA-256 audit hash chain
- An independent CLI verifier (VaultScan) that re-checks the chain without the Spring app
- A live ethical hacking lab exposing SQL injection and BOLA vulnerabilities alongside their fixes
- OWASP ZAP baseline security scan in CI

---

### The Seven Security Layers (each is one "day" of the build)

**Day 1 — Schema & Three-Role Model**
- Three PostgreSQL roles: `finshield_owner` (DDL/migrations), `finshield_app` (runtime, least privilege), `finshield_auditor` (read-only audit)
- `finshield_app` has SELECT only on financial tables — no UPDATE, no DELETE, no direct balance modification
- Security property: even a fully compromised application process cannot modify balances directly

**Day 2 — Row-Level Security (RLS)**
- RLS enabled on `customers`, `accounts`, `transfers`, `ledger_entries`
- Policy: `WHERE customer_id = app_customer_id()` — a session variable set from the JWT
- JWT filter calls `SET LOCAL app.customer_id = <cid>` inside the transaction boundary
- Security property: Alice's SELECT * FROM accounts returns only her rows — no WHERE clause needed in application code
- Key insight: defends against developer mistakes, not just attackers

**Day 3 — SECURITY DEFINER Transfer Function**
- `fn_post_transfer` owned by `finshield_owner`, runs with elevated privilege
- 10-step atomic operation: validate → idempotency check → lock both accounts in ascending ID order (deadlock prevention) → verify ownership (FS003) → check destination (FS002) → check funds (FS001) → debit → credit → ledger entries → record key
- Custom SQLSTATE error codes: FS001 (insufficient funds), FS002 (destination not found), FS003 (not your account), FS004 (idempotency key reused — different request), FS005 (inactive/currency mismatch), FS006 (bad request)
- Security property: the app role cannot call UPDATE accounts SET balance = ... under any circumstances

**Day 4 — SHA-256 Audit Hash Chain**
- Each audit event stores `prev_hash` (previous row's hash) and `hash` = SHA-256 of a canonical string of its own content
- Advisory lock 727001 serialises concurrent audit writes (prevents race conditions in the chain)
- PostgreSQL triggers block UPDATE, DELETE, TRUNCATE on audit_events — even for the table owner
- External anchor: `audit-anchor.json` stored outside the database — catches tail-deletion and full chain rewrites
- Security property: any modification to any audit event is detectable by re-computing the chain

**Day 5 — Ethical Hacking Lab (OWASP A01 + A03)**
- Two deliberately vulnerable endpoints and their fixed counterparts, exercised by a 10-test suite
- **SQL Injection (OWASP A03):** Payload `x' UNION SELECT username, password_hash FROM users--` against a string-concatenation endpoint leaks BCrypt hashes. The fix uses a parameterised JDBC query. Key insight: RLS on `customers` did NOT prevent this — the UNION branch targeted the `users` table which has no RLS policy.
- **BOLA — Broken Object Level Authorization (OWASP A01):** Alice sends a valid JWT but puts Bob's customer ID in the URL path. The vulnerable endpoint calls `rls.bind(urlId)` — attacker controls the RLS context. The fix calls `rls.bind(jwtCustomerId)` — identity always from the signed token.
- All 10 tests pass: 4 prove the exploit works, 6 prove the fix blocks it.

**Day 6 — VaultScan CLI + Security Headers + ZAP**
- **VaultScan:** Standalone fat JAR (zero Spring dependency, only PostgreSQL JDBC driver). Connects as DBA, re-reads every audit event, recomputes SHA-256 in Java, verifies the chain, compares head against the external anchor. Exit codes: 0=intact, 1=broken/anchor mismatch, 2=usage error.
- **Security headers** on every response via Spring Security: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`, `Referrer-Policy: no-referrer`
- **OWASP ZAP baseline scan** in GitHub Actions CI: starts Postgres, builds the app, waits for health, runs ZAP, uploads HTML report. 4 false positives suppressed with a rules file.

**Day 7 — Query Plans, Backup/Restore, Documentation**
- EXPLAIN ANALYZE captured for 5 hot-path queries in `QueryPlanTest.java` using Testcontainers
- Key results: account lookup by account_number uses Index Scan (unique constraint). Accounts-by-customer uses Bitmap Index Scan (`idx_accounts_customer`). Transfer locking SELECT uses BitmapOr + LockRows with ORDER BY id — proving deadlock prevention.
- `ops/backup.sh`: pg_dump + audit anchor snapshot in one command
- `ops/restore.sh`: restore to `finshield_restore` → VaultScan check → then promote
- Full README, evidence report, and this demo walkthrough

---

### Test Suite Summary

| Suite | Tests | What it covers |
|-------|-------|----------------|
| TransferServiceTest | 10 | Correctness, idempotency, concurrency (20 threads), overdraft |
| AuditChainTest | 11 | Chain integrity, tamper detection (payload edit, tail deletion, full rewrite), anchor bypass |
| ApiSecurityTest | 10 | JWT auth, RLS isolation, security headers, BOLA prevention |
| EthicalHackingLabTest | 10 | 4 exploit proofs + 6 fix verifications |
| QueryPlanTest | 5 | EXPLAIN ANALYZE for all hot-path queries |
| **Total** | **46** | 0 failures |

---

### Key Design Decisions Worth Highlighting

1. **No ORM (JdbcTemplate only):** Direct control over every SQL statement. ORM abstractions can silently bypass RLS if they issue queries outside transaction boundaries.
2. **FORCE ROW LEVEL SECURITY:** Policy applies even to the table owner — no accidental bypass.
3. **Identity never accepted from URL:** `rls.bind()` is called only with the JWT claim — directly prevents BOLA.
4. **Deadlock prevention by design:** Accounts always locked in ascending ID order inside the transfer function. Proven by 20 concurrent threads with no deadlock.
5. **External anchor:** A hash stored outside the database catches attacks that internal DB defences cannot — full table rewrite, restore from a tampered backup.
6. **Independent verifier:** VaultScan can run on a production database with no Spring app present — disaster recovery, forensic auditing, post-restore verification.

---

### Slide Structure to Follow

Build the presentation with these slides in this order:

1. **Title slide** — "FinShield: Defence in Depth for a Secure Banking Backend" · Subtitle: 7-day build · Stack badges (Spring Boot, PostgreSQL, React, Java)

2. **Problem Statement** — What goes wrong in typical banking backends: direct UPDATE access, no audit trail, SQL injection, BOLA, weak auth. Set up why each layer matters.

3. **Architecture Overview** — Three-tier diagram: HTTP Client → Spring Boot (JWT filter, RLS context setter) → PostgreSQL (RLS, SECURITY DEFINER, audit chain). Show data flow for a transfer request. Include the VaultScan box as an independent verifier outside the main flow.

4. **The 7 Layers at a Glance** — One table or visual: Layer name | Enforced at | Security property | "If bypassed, next layer is..."

5. **Layer 1 & 2 — Roles + RLS** — Show the three roles and their permissions. Explain how the JWT claim becomes a PostgreSQL session variable. Visualise: Alice's query → RLS policy → filtered result.

6. **Layer 3 — SECURITY DEFINER Transfer** — Show the 10-step function flow as a diagram. Highlight that the app role has no UPDATE privilege. Show the FS001–FS006 error code table.

7. **Layer 4 — SHA-256 Audit Chain** — Blockchain-style block diagram (3–4 blocks with arrows). Show the formula: `hash[n] = SHA256(prev_hash[n-1] ‖ timestamp ‖ actor ‖ payload)`. Explain append-only triggers and external anchor. Show what a tampered chain looks like vs. intact.

8. **Layer 5 — Ethical Hacking Lab: SQL Injection** — Side-by-side: VULNERABLE (string concat, no auth, UNION leaks hashes) vs. SECURE (parameterised, auth required, empty result). Include the actual payload. Explain why RLS did NOT protect the vulnerable endpoint.

9. **Layer 6 — Ethical Hacking Lab: BOLA** — Side-by-side: VULNERABLE (`rls.bind(urlId)`) vs. SECURE (`rls.bind(jwtCid)`). One-line code diff showing the fix. Explain the difference between authentication and authorization.

10. **Layer 7 — VaultScan + Headers + ZAP** — VaultScan architecture (standalone jar, DBA credentials, re-computes hashes). Security headers table (4 headers, what each prevents). ZAP CI pipeline diagram.

11. **Test Suite** — Table of 5 suites, test counts, what each covers. Headline: "46 tests, 0 failures, real PostgreSQL, no mocks."

12. **EXPLAIN ANALYZE — Query Plans** — Show the 5 query plan results in a table. Highlight: index scan on account_number lookup, bitmap index scan on customer_id filter, BitmapOr + LockRows proving deadlock prevention.

13. **Defence in Depth — What Stops What** — Matrix: rows = attack type (SQL injection, BOLA, direct DB access, audit tampering, replay attack), columns = layer. Show which layer catches each attack. Make it clear that multiple layers overlap — if one fails, another catches it.

14. **Demo Highlights** — 4 screenshots or mockups of the UI: Login with JWT decoded panel, Dashboard RLS switcher showing Bob's isolated accounts, Security Lab showing the SQLi terminal output, Audit Chain blockchain visualization.

15. **Conclusion** — Restate the thesis: security must be enforced at the right layer, not just trusted in the application. Summarise what was built. 46 tests. 7 layers. One week.

---

### Design Guidance

- **Colour scheme:** Dark navy/slate base (`#0a0e1a` or similar), blue accent (`#3b82f6`), cyan for highlights (`#06b6d4`), red for vulnerabilities (`#ef4444`), green for secure/fixed (`#22c55e`). Professional, not garish.
- **Typography:** Clean sans-serif (Calibri, Inter, or similar). Code snippets in monospace. Keep font sizes readable — no text smaller than 18pt on body slides.
- **Code on slides:** Keep code snippets very short (3–5 lines max). Use syntax highlighting where possible. Never put a wall of code on a slide.
- **Diagrams:** Prefer simple, clean flow diagrams over complex UML. Each diagram should communicate one idea.
- **Consistency:** Every slide should follow the same layout grid. Use icons sparingly — only where they add meaning.
- **Slide count:** Aim for 15–18 slides. Quality over quantity.
- **No bullet-point walls:** Maximum 4 bullet points per slide. Each bullet is one idea in one line.

---

### Tone

This is a technical presentation to faculty who understand software engineering. Do not over-explain basics. Lead with the security property, then show the mechanism. The presenter is confident — the system works, the tests prove it, the live demo backs it up.

## PROMPT END
