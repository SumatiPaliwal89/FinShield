package com.finshield;

import java.math.BigDecimal;
import java.nio.file.Path;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

@SpringBootTest
public abstract class AbstractDbTest {

    // Alice (customer 1): A, B.  Bob (customer 2): C.
    protected static final String A = "FS0000000001";
    protected static final String B = "FS0000000002";
    protected static final String C = "FS0000000003";

    private static final GenericContainer<?> DB =
            new GenericContainer<>(DockerImageName.parse("postgres:16"))
                    .withEnv("POSTGRES_DB", "finshield")
                    .withEnv("POSTGRES_USER", "postgres")
                    .withEnv("POSTGRES_PASSWORD", "test_admin")
                    .withExposedPorts(5432)
                    .withCopyFileToContainer(
                            MountableFile.forHostPath(Path.of("..", "docker", "postgres", "init",
                                    "01-roles.sql").toAbsolutePath()),
                            "/docker-entrypoint-initdb.d/01-roles.sql")
                    .waitingFor(Wait.forLogMessage(
                            ".*database system is ready to accept connections.*\\s", 2));

    /** Superpowered connection, used only to verify what really happened in the tables. */
    protected static final JdbcTemplate owner;

    static {
        DB.start();
        owner = new JdbcTemplate(new DriverManagerDataSource(url(), "finshield_owner", "owner_dev_pw"));
    }

    private static String url() {
        return "jdbc:postgresql://" + DB.getHost() + ":" + DB.getMappedPort(5432) + "/finshield";
    }

    @DynamicPropertySource
    static void dbProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", AbstractDbTest::url);
        registry.add("spring.flyway.url", AbstractDbTest::url);
    }

    /** Reset the database before each test. */
    @BeforeEach
    protected void resetData() {
        // Test-only: the owner (a DBA-level actor) switches the append-only guard off to wipe the log.
        owner.execute("ALTER TABLE audit_events DISABLE TRIGGER trg_audit_no_row_mutation");
        owner.execute("DELETE FROM audit_events");
        owner.execute("ALTER TABLE audit_events ENABLE TRIGGER trg_audit_no_row_mutation");

        owner.execute("TRUNCATE ledger_entries, idempotency_keys, transfers, security_events CASCADE");
        owner.update("""
                UPDATE accounts SET balance = CASE account_number
                  WHEN 'FS0000000001' THEN 100000
                  WHEN 'FS0000000002' THEN 25000
                  WHEN 'FS0000000003' THEN 50000
                  ELSE 10000 END""");
    }

    protected BigDecimal balance(String account) {
        return owner.queryForObject("SELECT balance FROM accounts WHERE account_number = ?",
                BigDecimal.class, account);
    }

    protected int count(String sql) {
        return owner.queryForObject(sql, Integer.class);
    }
}