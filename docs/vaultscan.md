# VaultScan

VaultScan is a **standalone** audit-chain verifier that runs independently of the
Spring Boot application.  It connects to PostgreSQL directly and re-computes
every SHA-256 in the `audit_events` chain.

## Why it exists

The in-app `AuditVerifier` and the `GET /api/audit/verify` endpoint are correct,
but they share a trust boundary with the application.  If the application code,
its database connection, or its secrets were compromised, an attacker could in
theory tamper the response.

VaultScan removes that dependency: build it on a separate machine, run it with
read-only database credentials, and you get an independent answer.

## Build

```bash
cd vaultscan
mvn package      # produces vaultscan/target/vaultscan.jar
```

Requires Java 21+.  The only runtime dependency is the PostgreSQL JDBC driver,
which is bundled into the fat jar.

## Run

```
java -jar vaultscan/target/vaultscan.jar <jdbc-url> <user> <password> [anchor.json]
```

| Argument | Example |
|---|---|
| `jdbc-url` | `jdbc:postgresql://localhost:5433/finshield` |
| `user` | `finshield_owner` (or any role with SELECT on `audit_events`) |
| `password` | `owner_dev_pw` |
| `anchor.json` | `audit-anchor.json` (optional; created by `GET /api/audit/verify`) |

### Example output — chain intact, anchor matches

```
[VaultScan] PASS  412 event(s) checked
           head  id=412   hash=3fa85f64...
[VaultScan] ANCHOR MATCH  id=412
```

### Example output — tampered event detected

```
[VaultScan] FAIL  first broken id=207
           reason: hash mismatch — event content was modified
```

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Chain intact; anchor matches if supplied |
| `1` | Chain broken, or anchor mismatch |
| `2` | Usage error or connection failure |

## What it checks

For each event (streamed in `id` order, 1 000 rows at a time):

1. **Chain link** — `prev_hash` of this event equals the `hash` of the previous
   event (or 64 zeros for the first event).  Detects deletions, insertions, and
   reorderings.

2. **Content integrity** — SHA-256 of `audit_canonical(prev_hash, created_at,
   event_type, actor, payload)` equals the stored `hash`.  Detects any
   modification to the event data.

3. **Anchor check** (optional) — the `headId` and `headHash` in the supplied
   JSON file match the last event in the current database.  Detects tail
   deletions and full-chain rewrites that would otherwise pass chain verification.

## Known limits

- **Canonicalization is not fully independent**: VaultScan calls `audit_canonical()`
  — a database function — to produce the canonical string.  An attacker with
  full database access could modify both the data *and* the function so VaultScan
  still sees consistent hashes.  For complete independence, re-implement
  `audit_canonical` in Java using a JSONB library.

- **The database can lie**: if the database server itself is compromised, no
  client-side verifier is trustworthy.  The correct mitigation is to store
  signed anchors outside the database (a write-once object store, a signed
  email trail, a separate ledger service).

## Generating an anchor

```bash
# 1. Login as the auditor
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"auditor","password":"Auditor#Dev2026"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 2. Capture the current chain head (store it somewhere OUTSIDE the database)
curl -s http://localhost:8080/api/audit/verify \
  -H "Authorization: Bearer $TOKEN" \
  | tee audit-anchor.json
```

The resulting `audit-anchor.json` is the checkpoint.  Any later tampering —
even a full chain rewrite — will cause the anchor check to fail.
