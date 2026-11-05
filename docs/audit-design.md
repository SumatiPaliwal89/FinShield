# Audit design

## What is recorded
- TRANSFER_COMPLETED (database trigger on `transfers`, same transaction as the money movement)
- SECURITY_EVENT (database trigger on `security_events`, e.g. failed logins)

## How it works
Each event stores `prev_hash` and `hash = SHA-256(canonical(prev_hash, created_at, event_type, actor, payload))`.
The canonical form is a JSON array, so field boundaries are unambiguous.
Appends are serialized with a Postgres advisory lock; the first event uses 64 zeros as `prev_hash`.

## Who may write
- The application role has SELECT only on `audit_events`.
- Only `fn_append_audit` (SECURITY DEFINER, owner-run, called by triggers) inserts rows.
- UPDATE, DELETE and TRUNCATE are rejected by triggers even for the table owner (unless the trigger is dropped or disabled).

## What the chain detects
Modified events, deleted or inserted events in the middle of the chain, reordered events.

## What the chain does NOT prevent
An attacker with unrestricted database access can (a) rewrite every event after a change and recompute all hashes,
or (b) delete the newest events. In both cases the chain still verifies. This is demonstrated in `AuditChainTest`.

## Mitigation: external checkpoint anchoring
Periodically store the latest `(id, hash)` outside the database's trust boundary (a separate host, a signed
email or ticket, a write-once object store). `GET /api/audit/anchor-check` compares a stored checkpoint with
the current database. Any rewrite or tail deletion changes or removes the anchored hash.

## Known trade-offs
- The advisory lock serializes audit appends. Production systems batch, or append at commit time.
- Canonicalization currently relies on a database function; VaultScan (Day 6) will re-verify independently.