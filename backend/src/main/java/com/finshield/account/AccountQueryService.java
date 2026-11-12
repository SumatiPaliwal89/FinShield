package com.finshield.account;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finshield.security.RlsContext;

@Service
public class AccountQueryService {

    public record AccountView(String accountNumber, String currency, BigDecimal balance, String status) {
    }

    public record LedgerView(long id, UUID transferId, String accountNumber, String entryType,
                             BigDecimal amount, Instant createdAt) {
    }

    public record TransferView(UUID id, String fromAccountNumber, String toAccountNumber,
                               BigDecimal amount, String status, Instant createdAt) {
    }

    private final JdbcTemplate jdbc;
    private final RlsContext rls;

    public AccountQueryService(JdbcTemplate jdbc, RlsContext rls) {
        this.jdbc = jdbc;
        this.rls = rls;
    }

    // Note: no "WHERE customer_id = ?" anywhere. The database (RLS) does the filtering.

    @Transactional(readOnly = true)
    public List<AccountView> list(long customerId) {
        rls.bind(customerId);
        return jdbc.query("SELECT account_number, currency, balance, status FROM accounts ORDER BY id",
                (rs, i) -> new AccountView(rs.getString(1), rs.getString(2),
                        rs.getBigDecimal(3), rs.getString(4)));
    }

    @Transactional(readOnly = true)
    public Optional<AccountView> find(long customerId, String accountNumber) {
        rls.bind(customerId);
        return jdbc.query("SELECT account_number, currency, balance, status FROM accounts WHERE account_number = ?",
                (rs, i) -> new AccountView(rs.getString(1), rs.getString(2),
                        rs.getBigDecimal(3), rs.getString(4)),
                accountNumber).stream().findFirst();
    }

    @Transactional(readOnly = true)
    public List<LedgerView> ledger(long customerId) {
        rls.bind(customerId);
        return jdbc.query("""
                SELECT le.id, le.transfer_id, a.account_number, le.entry_type, le.amount, le.created_at
                FROM ledger_entries le JOIN accounts a ON a.id = le.account_id
                ORDER BY le.id DESC LIMIT 50""",
                (rs, i) -> new LedgerView(rs.getLong(1), rs.getObject(2, UUID.class),
                        rs.getString(3), rs.getString(4), rs.getBigDecimal(5),
                        rs.getTimestamp(6).toInstant()));
    }

    @Transactional(readOnly = true)
    public List<TransferView> transferHistory(long customerId) {
        rls.bind(customerId);
        return jdbc.query("""
                SELECT t.id, t.from_account_number, t.to_account_number,
                       t.amount, t.status, t.created_at
                FROM transfers t
                WHERE t.from_account_id IN (SELECT id FROM accounts)
                   OR t.to_account_id   IN (SELECT id FROM accounts)
                ORDER BY t.created_at DESC
                LIMIT 20""",
                (rs, i) -> new TransferView(
                        rs.getObject(1, UUID.class),
                        rs.getString(2), rs.getString(3),
                        rs.getBigDecimal(4), rs.getString(5),
                        rs.getTimestamp(6).toInstant()));
    }
}