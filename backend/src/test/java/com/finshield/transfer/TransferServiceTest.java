package com.finshield.transfer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import com.finshield.AbstractDbTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class TransferServiceTest extends AbstractDbTest {

    @Autowired
    TransferService service;

    // ---------- correctness ----------

    @Test
    void transferMovesMoneyAndWritesDebitAndCredit() {
        UUID id = service.transfer(1, "k1", A, C, new BigDecimal("500.00"));

        assertThat(balance(A)).isEqualByComparingTo("99500");
        assertThat(balance(C)).isEqualByComparingTo("50500");

        Integer entries = owner.queryForObject(
                "SELECT count(*) FROM ledger_entries WHERE transfer_id = ?",
                Integer.class, id);

        assertThat(entries).isEqualTo(2);
    }

    @Test
    void replayWithSameKeyDoesNotTransferTwice() {
        UUID first = service.transfer(1, "k1", A, C, new BigDecimal("500"));
        UUID second = service.transfer(1, "k1", A, C, new BigDecimal("500"));

        assertThat(second).isEqualTo(first);
        assertThat(balance(A)).isEqualByComparingTo("99500");
        assertThat(count("SELECT count(*) FROM transfers")).isEqualTo(1);
    }

    @Test
    void sameKeyWithDifferentRequestIsRejected() {
        service.transfer(1, "k1", A, C, new BigDecimal("500"));

        assertThatThrownBy(
                () -> service.transfer(1, "k1", A, C, new BigDecimal("999")))
                .isInstanceOf(TransferException.class)
                .hasFieldOrPropertyWithValue(
                        "reason",
                        TransferException.Reason.IDEMPOTENCY_CONFLICT);
    }

    @Test
    void insufficientFundsRollsBackEverything() {
        assertThatThrownBy(
                () -> service.transfer(1, "k1", A, C, new BigDecimal("999999")))
                .isInstanceOf(TransferException.class)
                .hasFieldOrPropertyWithValue(
                        "reason",
                        TransferException.Reason.INSUFFICIENT_FUNDS);

        assertThat(balance(A)).isEqualByComparingTo("100000");
        assertThat(count("SELECT count(*) FROM transfers")).isZero();
        assertThat(count("SELECT count(*) FROM idempotency_keys")).isZero();
    }

    @Test
    void cannotSpendFromSomeoneElsesAccount() {
        // Bob (customer 2) tries to move Alice's money
        assertThatThrownBy(
                () -> service.transfer(2, "k1", A, C, new BigDecimal("100")))
                .isInstanceOf(TransferException.class)
                .hasFieldOrPropertyWithValue(
                        "reason",
                        TransferException.Reason.NOT_AUTHORIZED);

        assertThat(balance(A)).isEqualByComparingTo("100000");
    }

    @Test
    void invalidAmountsAreRejected() {
        for (String bad : new String[]{"0", "-5", "1.23456"}) {
            assertThatThrownBy(
                    () -> service.transfer(
                            1, "k-" + bad, A, C, new BigDecimal(bad)))
                    .isInstanceOf(TransferException.class)
                    .hasFieldOrPropertyWithValue(
                            "reason",
                            TransferException.Reason.INVALID_REQUEST);
        }
    }

    // ---------- concurrency ----------

    @Test
    void manyConcurrentTransfersNeverLoseOrCreateMoney() throws Exception {
        List<Callable<UUID>> tasks = new ArrayList<>();

        for (int i = 0; i < 20; i++) {
            String key = "c-" + i;
            tasks.add(() ->
                    service.transfer(1, key, A, C, new BigDecimal("100")));
        }

        runAll(tasks);

        assertThat(balance(A)).isEqualByComparingTo("98000");
        assertThat(balance(C)).isEqualByComparingTo("52000");
    }

    @Test
    void opposingTransfersDoNotDeadlock() throws Exception {
        List<Callable<UUID>> tasks = new ArrayList<>();

        for (int i = 0; i < 10; i++) {
            String k1 = "ab-" + i;
            String k2 = "ba-" + i;

            tasks.add(() ->
                    service.transfer(1, k1, A, C, new BigDecimal("100")));

            tasks.add(() ->
                    service.transfer(2, k2, C, A, new BigDecimal("100")));
        }

        runAll(tasks);

        assertThat(balance(A)).isEqualByComparingTo("100000");
        assertThat(balance(C)).isEqualByComparingTo("50000");
    }

    @Test
    void sameIdempotencyKeyUsedConcurrentlyExecutesOnce() throws Exception {
        List<Callable<UUID>> tasks = new ArrayList<>();

        for (int i = 0; i < 10; i++) {
            tasks.add(() ->
                    service.transfer(1, "same-key", A, C, new BigDecimal("100")));
        }

        List<UUID> results = runAll(tasks);

        assertThat(results).containsOnly(results.get(0));
        assertThat(balance(A)).isEqualByComparingTo("99900");
        assertThat(count("SELECT count(*) FROM transfers")).isEqualTo(1);
    }

    @Test
    void concurrentOverdraftAttemptsNeverGoNegative() throws Exception {
        // Account B has 25,000. Twenty transfers of 2,000 compete:
        // only 12 can succeed.
        List<Callable<Boolean>> tasks = new ArrayList<>();

        for (int i = 0; i < 20; i++) {
            String key = "od-" + i;

            tasks.add(() -> {
                try {
                    service.transfer(1, key, B, C, new BigDecimal("2000"));
                    return true;
                } catch (TransferException e) {
                    return false;
                }
            });
        }

        long succeeded = runAll(tasks)
                .stream()
                .filter(Boolean::booleanValue)
                .count();

        assertThat(succeeded).isEqualTo(12);
        assertThat(balance(B)).isEqualByComparingTo("1000");
        assertThat(balance(C)).isEqualByComparingTo("74000");
    }

    private <T> List<T> runAll(List<Callable<T>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch go = new CountDownLatch(1);
        List<Future<T>> futures = new ArrayList<>();

        for (Callable<T> task : tasks) {
            futures.add(pool.submit(() -> {
                go.await();
                return task.call();
            }));
        }

        go.countDown();

        List<T> results = new ArrayList<>();

        for (Future<T> f : futures) {
            results.add(f.get(60, TimeUnit.SECONDS));
        }

        pool.shutdown();
        return results;
    }
}