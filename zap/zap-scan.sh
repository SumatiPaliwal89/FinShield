#!/usr/bin/env bash
# zap-scan.sh — run an OWASP ZAP baseline scan against a locally running FinShield.
#
# Prerequisites:
#   1. Docker is running
#   2. The app is up:  docker compose up -d  then  cd backend && ./mvnw spring-boot:run
#   3. The app is healthy: curl http://localhost:8080/actuator/health
#
# Usage:
#   ./zap/zap-scan.sh [target-url]
#
# Default target: http://host.docker.internal:8080
# Output: zap/report.html

set -euo pipefail

TARGET="${1:-http://host.docker.internal:8080}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPORT="$SCRIPT_DIR/report.html"

echo "[ZAP] Scanning $TARGET ..."

docker run --rm \
  -v "$SCRIPT_DIR:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
    -t "$TARGET" \
    -c /zap/wrk/zap-rules.tsv \
    -r /zap/wrk/report.html \
    -a \
    -j

echo ""
echo "[ZAP] Report written to: $REPORT"
echo "[ZAP] Open it in a browser to view the full findings."
