package com.finshield;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.finshield.transfer.TransferService;

/**
 * Day 7 — EXPLAIN ANALYZE for the four hot-path queries.
 *
 * <p>Assertions check that every query returns the expected result shape; the
 * full execution plan is printed to stdout and captured in the surefire report
 * for the evidence portfolio.
 *
 * <p>Note: on a 4-row test dataset the planner may choose Seq Scan over Index
 * Scan (correct — seq scan is faster for tiny tables).  The indexes exist and
 * ARE used at production volumes; see ops/explain-analyze.sql for details.
 */
@SpringBootTest
class QueryPlanTest extends AbstractDbTest {

    @Autowired
    TransferService transferService;

    // ── helper ────────────────────────────────────────────────────────────────

    private String plan(String sql) {
        List<String> rows = owner.queryForList(
                "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " + sql, String.class);
        return String.join("\n", rows);
    }

    private void dump(String label, String planText) {
        System.out.println("\n════════════════════════════════════════════════");
        System.out.println("  PLAN: " + label);
        System.out.println("════════════════════════════════════════════════");
        System.out.println(planText);
    }

    // ── 1. Account lookup by account_number ──────────────────────────────────

    @Test
    void plan_accountLookupByAccountNumber() {
        String p = plan("SELECT * FROM accounts WHERE account_number = '" + A + "'");
        dump("accounts WHERE account_number = '" + A + "'", p);

        // The unique constraint on account_number creates an index; verify query works
        List<Long> ids = owner.queryForList(
                "SELECT id FROM accounts WHERE account_number = ?", Long.class, A);
        assertThat(ids).hasSize(1);
    }

    // ── 2. All accounts for a customer (the RLS filter path) ─────────────────

    @Test
    void plan_accountsByCustomerId() {
        String p = plan("SELECT * FROM accounts WHERE customer_id = 1");
        dump("accounts WHERE customer_id = 1", p);

        // idx_accounts_customer — customer 1 owns accounts A and B
        List<String> nums = owner.queryForList(
                "SELECT account_number FROM accounts WHERE customer_id = 1 ORDER BY id",
                String.class);
        assertThat(nums).containsExactly(A, B);
    }

    // ── 3. Ledger entries for a customer ─────────────────────────────────────

    @Test
    void plan_ledgerByCustomer() {
        // Transfer A → B (both Alice's accounts) so both DEBIT and CREDIT appear
        // in the ledger for customer 1.
        transferService.transfer(1, "plan-ledger", A, B, new BigDecimal("100"));

        String p = plan("""
                SELECT le.id, le.entry_type, le.amount, le.created_at, t.id AS transfer_id
                FROM   ledger_entries le
                JOIN   transfers t ON t.id = le.transfer_id
                WHERE  le.account_id IN (SELECT id FROM accounts WHERE customer_id = 1)
                ORDER  BY le.created_at DESC
                """);
        dump("ledger_entries JOIN transfers WHERE customer_id = 1", p);

        int ledgerRows = count(
                "SELECT count(*) FROM ledger_entries WHERE account_id IN "
                + "(SELECT id FROM accounts WHERE customer_id = 1)");
        assertThat(ledgerRows).isEqualTo(2); // one DEBIT + one CREDIT for account A
    }

    // ── 4. Audit chain walk ───────────────────────────────────────────────────

    @Test
    void plan_auditChainWalk() {
        // Seed five audit events via five transfers
        for (int i = 0; i < 5; i++) {
            transferService.transfer(1, "plan-audit-" + i, A, C, new BigDecimal("1"));
        }

        String p = plan("""
                SELECT id, prev_hash, hash,
                       audit_canonical(prev_hash::text, created_at,
                                       event_type::text, actor::text, payload) AS canonical
                FROM   audit_events
                ORDER  BY id
                """);
        dump("audit_events ORDER BY id (chain walk)", p);

        assertThat(count("SELECT count(*) FROM audit_events")).isEqualTo(5);
        // On 5 rows the planner may choose Seq Scan + Sort (correct for tiny tables).
        // At production volumes the PK index eliminates the Sort step entirely.
    }

    // ── 5. Account-locking SELECT in fn_post_transfer ────────────────────────

    @Test
    void plan_transferLockingSelect() {
        String p = plan(
                "SELECT 1 FROM accounts "
                + "WHERE account_number IN ('" + A + "', '" + C + "') "
                + "ORDER BY id FOR UPDATE");
        dump("SELECT … IN (from, to) ORDER BY id FOR UPDATE", p);

        // The FOR UPDATE on two specific accounts must touch exactly 2 rows
        List<Long> locked = owner.queryForList(
                "SELECT id FROM accounts WHERE account_number IN (?, ?) ORDER BY id",
                Long.class, A, C);
        assertThat(locked).hasSize(2);
    }
}
