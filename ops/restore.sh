#!/usr/bin/env bash
# ops/restore.sh — restore a dump into a verification database and check the
# audit chain before promoting.
#
# Usage: ./ops/restore.sh <dump-file> [anchor.json]
#
# The dump is restored into finshield_restore (NOT the live finshield database)
# so you can verify it before swapping.  To promote: rename finshield_restore
# to finshield (or update the connection strings and restart the app).
#
# Requires: pg_restore, psql on PATH, Docker Compose DB running on port 5433.

set -euo pipefail

DUMP="${1:?Usage: restore.sh <dump-file> [anchor.json]}"
ANCHOR="${2:-}"
RESTORE_DB="finshield_restore"

echo "[restore] Target database: $RESTORE_DB"

# ── 1. Create a fresh target database ────────────────────────────────────────
echo "[restore] Dropping and recreating $RESTORE_DB ..."
PGPASSWORD=postgres_admin_dev psql \
  -h localhost -p 5433 \
  -U postgres \
  -c "DROP DATABASE IF EXISTS ${RESTORE_DB};" \
  -c "CREATE DATABASE ${RESTORE_DB} OWNER finshield_owner;"

# ── 2. Grant connect to the app role ─────────────────────────────────────────
PGPASSWORD=postgres_admin_dev psql \
  -h localhost -p 5433 \
  -U postgres \
  -d "$RESTORE_DB" \
  -c "GRANT CONNECT ON DATABASE ${RESTORE_DB} TO finshield_app;"

# ── 3. Restore ────────────────────────────────────────────────────────────────
echo "[restore] Restoring $DUMP into $RESTORE_DB ..."
PGPASSWORD=owner_dev_pw pg_restore \
  -h localhost -p 5433 \
  -U finshield_owner \
  --dbname="$RESTORE_DB" \
  --no-acl \
  --exit-on-error \
  "$DUMP"

# ── 4. Sanity check: row counts ───────────────────────────────────────────────
echo ""
echo "[restore] Row counts in $RESTORE_DB:"
PGPASSWORD=owner_dev_pw psql \
  -h localhost -p 5433 \
  -U finshield_owner \
  -d "$RESTORE_DB" \
  -c "SELECT
        (SELECT count(*) FROM customers)     AS customers,
        (SELECT count(*) FROM accounts)      AS accounts,
        (SELECT count(*) FROM transfers)     AS transfers,
        (SELECT count(*) FROM ledger_entries)AS ledger_entries,
        (SELECT count(*) FROM audit_events)  AS audit_events;"

# ── 5. VaultScan audit chain check ───────────────────────────────────────────
if [ -f vaultscan/target/vaultscan.jar ]; then
  echo ""
  echo "[restore] Running VaultScan against $RESTORE_DB ..."
  ANCHOR_ARG=""
  if [ -n "$ANCHOR" ]; then
    ANCHOR_ARG="$ANCHOR"
  fi
  java -jar vaultscan/target/vaultscan.jar \
    "jdbc:postgresql://localhost:5433/${RESTORE_DB}" \
    finshield_owner owner_dev_pw \
    $ANCHOR_ARG
else
  echo "[restore] VaultScan jar not found — run 'make vaultscan-build' first."
fi

echo ""
echo "[restore] Complete. Review $RESTORE_DB before promoting it to production."
echo "          To promote: rename $RESTORE_DB → finshield (with app offline)."
