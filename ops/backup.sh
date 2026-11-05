#!/usr/bin/env bash
# ops/backup.sh — logical backup + audit anchor snapshot.
#
# Usage: ./ops/backup.sh [output-dir]
# Default output: ops/backups/
#
# Requires: pg_dump on PATH, Docker Compose DB running on port 5433.

set -euo pipefail

OUTDIR="${1:-ops/backups}"
mkdir -p "$OUTDIR"

STAMP=$(date +%Y%m%d-%H%M%S)
DUMP="$OUTDIR/finshield-${STAMP}.dump"
TOC="$OUTDIR/finshield-${STAMP}.toc"

# ── 1. Dump ──────────────────────────────────────────────────────────────────
echo "[backup] Dumping database to $DUMP ..."
PGPASSWORD=owner_dev_pw pg_dump \
  -h localhost -p 5433 \
  -U finshield_owner \
  --format=custom \
  --no-acl \
  --file="$DUMP" \
  finshield

# ── 2. Verify the dump is readable ───────────────────────────────────────────
echo "[backup] Verifying dump ..."
pg_restore --list "$DUMP" > "$TOC"
TABLE_COUNT=$(grep -c "^[0-9].*TABLE DATA" "$TOC" || true)
echo "[backup] Dump contains $TABLE_COUNT table-data sections — TOC: $TOC"

# ── 3. Capture the audit anchor at backup time ────────────────────────────────
# Requires the Spring Boot app to be running; skip gracefully if it is not.
ANCHOR="$OUTDIR/anchor-${STAMP}.json"
TOKEN=$(curl -sf --max-time 3 \
  -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"auditor","password":"Auditor#Dev2026"}' \
  2>/dev/null | grep -o '"token":"[^"]*"' | cut -d'"' -f4) || true

if [ -n "${TOKEN:-}" ]; then
  curl -sf --max-time 3 \
    http://localhost:8080/api/audit/verify \
    -H "Authorization: Bearer $TOKEN" \
    > "$ANCHOR"
  echo "[backup] Audit anchor written to $ANCHOR"
  echo "[backup]   Store $ANCHOR somewhere OUTSIDE this database."
else
  echo "[backup] App not reachable — audit anchor skipped."
fi

echo "[backup] Done: $DUMP"
