package com.finshield.transfer;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.UUID;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TransferService {

    private final JdbcTemplate jdbc;

    public TransferService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public UUID transfer(long customerId, String idempotencyKey,
                         String fromAccount, String toAccount, BigDecimal amount) {

        // "true" = transaction-local: the identity vanishes at commit/rollback,
        // so a pooled connection can never leak one customer's identity to the next request.
        jdbc.queryForObject("SELECT set_config('app.customer_id', ?, true)",
                String.class, Long.toString(customerId));

        try {
            return jdbc.queryForObject("SELECT fn_post_transfer(?, ?, ?, ?)",
                    UUID.class, idempotencyKey, fromAccount, toAccount, amount);
        } catch (DataAccessException e) {
            for (Throwable t = e; t != null; t = t.getCause()) {
                if (t instanceof SQLException sql) {
                    TransferException.Reason reason =
                            TransferException.Reason.fromSqlState(sql.getSQLState());
                    if (reason != null) {
                        throw new TransferException(reason, e);
                    }
                }
            }
            throw e;
        }
    }
}