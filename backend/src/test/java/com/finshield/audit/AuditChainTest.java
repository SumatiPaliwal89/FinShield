package com.finshield.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.finshield.AbstractDbTest;
import com.finshield.audit.AuditVerifier.Result;
import com.finshield.transfer.TransferException;
import com.finshield.transfer.TransferService;

class AuditChainTest extends AbstractDbTest {

    @Autowired
    TransferService service;

    @Autowired
    AuditVerifier verifier;

    @Autowired
    JdbcTemplate appJdbc;   // connects as finshield_app, the least-privilege role

    // ---------- helpers ----------

    private void makeTransfers(int n) {
        for (int i = 0; i < n; i++) {
            service.transfer(1, "k" + i, A, C, new BigDecimal("10"));
        }
    }

    private List<Long> auditIds() {
        return owner.queryForList("SELECT id FROM audit_events ORDER BY id", Long.class);
    }

    /** Simulates an attacker with owner rights who switches the append-only guard off. */
    private void asPrivilegedAttacker(Runnable attack) {
        owner.execute("ALTER TABLE audit_events DISABLE TRIGGER trg_audit_no_row_mutation");
        try {
            attack.run();
        } finally {
            owner.execute("ALTER TABLE audit_events ENABLE TRIGGER trg_audit_no_row_mutation");
        }
    }

    // ---------- what gets recorded ----------

    @Test
    void emptyChainIsValid() {
        Result r = verifier.verify();
        assertThat(r.valid()).isTrue();
        assertThat(r.eventsChecked()).isZero();
    }

    @Test
    void everyTransferIsAuditedAndChainVerifies() {
        makeTransfers(3);

        Result r = verifier.verify();
        assertThat(r.valid()).isTrue();
        assertThat(r.eventsChecked()).isEqualTo(3);
        String firstPrev = owner.queryForObject(
                "SELECT prev_hash FROM audit_events ORDER BY id LIMIT 1", String.class);
        assertThat(firstPrev).isEqualTo(AuditVerifier.GENESIS);
    }

    @Test
    void failedTransferLeavesNoAuditEvent() {
        assertThatThrownBy(() -> service.transfer(1, "k1", A, C, new BigDecimal("999999")))
                .isInstanceOf(TransferException.class);

        assertThat(count("SELECT count(*) FROM audit_events")).isZero();
    }

    @Test
    void replayedTransferIsAuditedOnlyOnce() {
        service.transfer(1, "same", A, C, new BigDecimal("10"));
        service.transfer(1, "same", A, C, new BigDecimal("10"));

        assertThat(count("SELECT count(*) FROM audit_events")).isEqualTo(1);
    }

    @Test
    void securityEventsInsertedByTheAppAreAudited() {
        appJdbc.update("INSERT INTO security_events(event_type, severity) VALUES ('TEST', 'LOW')");

        assertThat(count("SELECT count(*) FROM audit_events WHERE event_type = 'SECURITY_EVENT'")).isEqualTo(1);
        assertThat(verifier.verify().valid()).isTrue();
    }

    @Test
    void concurrentTransfersKeepOneLinearChain() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(12);
        List<Future<UUID>> futures = new ArrayList<>();
        for (int i = 0; i < 24; i++) {
            String key = "c" + i;
            futures.add(pool.submit(() -> service.transfer(1, key, A, C, new BigDecimal("1"))));
        }
        for (Future<UUID> f : futures) {
            f.get(60, TimeUnit.SECONDS);
        }
        pool.shutdown();

        Result r = verifier.verify();
        assertThat(r.valid()).isTrue();
        assertThat(r.eventsChecked()).isEqualTo(24);
    }

    // ---------- tamper detection ----------

    @Test
    void modifiedEventIsDetected() {
        makeTransfers(5);
        long victim = auditIds().get(2);

        asPrivilegedAttacker(() -> owner.update(
                "UPDATE audit_events SET payload = jsonb_set(payload, '{amount}', '\"999999.0000\"') WHERE id = ?",
                victim));

        Result r = verifier.verify();
        assertThat(r.valid()).isFalse();
        assertThat(r.firstBrokenId()).isEqualTo(victim);
        assertThat(r.problem()).contains("hash mismatch");
    }

    @Test
    void deletedEventIsDetected() {
        makeTransfers(5);
        List<Long> ids = auditIds();

        asPrivilegedAttacker(() -> owner.update("DELETE FROM audit_events WHERE id = ?", ids.get(2)));

        Result r = verifier.verify();
        assertThat(r.valid()).isFalse();
        assertThat(r.firstBrokenId()).isEqualTo(ids.get(3));    // the event AFTER the hole
        assertThat(r.problem()).contains("prev_hash");
    }

    // ---------- the honest limits of a hash chain ----------

    @Test
    void deletingTheNewestEventsIsInvisibleToTheChainButCaughtByAnAnchor() {
        makeTransfers(4);
        Result before = verifier.verify();                       // checkpoint stored OFF the database

        asPrivilegedAttacker(() -> owner.update("DELETE FROM audit_events WHERE id = ?", before.headId()));

        assertThat(verifier.verify().valid()).isTrue();          // chain alone cannot see it
        assertThat(verifier.matchesAnchor(before.headId(), before.headHash())).isFalse();
    }

    @Test
    void fullChainRewriteEvadesVerificationButNotAnExternalAnchor() {
        makeTransfers(4);
        Result before = verifier.verify();
        long victim = auditIds().get(1);

        asPrivilegedAttacker(() -> {
            owner.update("UPDATE audit_events SET payload = jsonb_set(payload, '{amount}', '\"1.0000\"') WHERE id = ?",
                    victim);
            String prev = AuditVerifier.GENESIS;                 // attacker knows the algorithm
            for (long id : auditIds()) {
                String canonical = owner.queryForObject(
                        "SELECT audit_canonical(?, created_at, event_type::text, actor::text, payload) "
                                + "FROM audit_events WHERE id = ?", String.class, prev, id);
                String hash = AuditVerifier.sha256Hex(canonical);
                owner.update("UPDATE audit_events SET prev_hash = ?, hash = ? WHERE id = ?", prev, hash, id);
                prev = hash;
            }
        });

        assertThat(verifier.verify().valid()).isTrue();          // the forged chain is self-consistent!
        assertThat(verifier.matchesAnchor(before.headId(), before.headHash())).isFalse();   // the anchor exposes it
    }

    // ---------- who may write ----------

  @Test
  void appRoleCannotWriteAuditEventsAndNeitherCanTheOwnerCasually() {
      makeTransfers(1);

      assertThatThrownBy(() -> appJdbc.update(
              "INSERT INTO audit_events(event_type, actor, payload, prev_hash, hash) "
                      + "VALUES ('FORGED','x','{}', repeat('0',64), repeat('b',64))"))
              .hasRootCauseMessage("ERROR: permission denied for table audit_events");

      assertThatThrownBy(() -> appJdbc.update("UPDATE audit_events SET actor = 'x'"))
              .hasRootCauseMessage("ERROR: permission denied for table audit_events");

      assertThatThrownBy(() -> appJdbc.update("DELETE FROM audit_events"))
              .hasRootCauseMessage("ERROR: permission denied for table audit_events");

      assertThatThrownBy(() -> appJdbc.execute("TRUNCATE audit_events"))
              .hasRootCauseMessage("ERROR: permission denied for table audit_events");

      // Even the table owner is stopped by the trigger unless they deliberately disable it.
      assertThatThrownBy(() -> owner.update("UPDATE audit_events SET actor = 'x'"))
              .hasMessageContaining("append-only");
  }
}