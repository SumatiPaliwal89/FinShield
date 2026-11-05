.PHONY: up down test backup restore vaultscan zap help

## ── local dev ────────────────────────────────────────────────────────────────

up:          ## Start Postgres in Docker
	docker compose up -d

down:        ## Stop and remove containers (data volume is preserved)
	docker compose down

## ── tests ────────────────────────────────────────────────────────────────────

test:        ## Run all 41 tests (Testcontainers spins its own Postgres)
	cd backend && ./mvnw test

## ── operations ───────────────────────────────────────────────────────────────

backup:      ## pg_dump to ops/backups/ and capture audit anchor
	bash ops/backup.sh

restore:     ## Restore a dump into finshield_restore for verification
	@test -n "$(DUMP)" || (echo "Usage: make restore DUMP=ops/backups/finshield-*.dump" && exit 1)
	bash ops/restore.sh $(DUMP) $(ANCHOR)

## ── vaultscan ────────────────────────────────────────────────────────────────

vaultscan-build:  ## Build the VaultScan fat jar
	cd vaultscan && mvn -q package -DskipTests

vaultscan:   ## Verify audit chain (requires 'make up' and the app running)
vaultscan: vaultscan-build
	java -jar vaultscan/target/vaultscan.jar \
	  jdbc:postgresql://localhost:5433/finshield \
	  finshield_owner owner_dev_pw \
	  audit-anchor.json

## ── security scan ────────────────────────────────────────────────────────────

zap:         ## OWASP ZAP baseline scan (requires Docker + app running on :8080)
	bash zap/zap-scan.sh

## ── help ─────────────────────────────────────────────────────────────────────

help:        ## List all targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
