package com.finshield.transfer;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.UUID;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finshield.security.RlsContext;

@Service
public class TransferService {

    private final JdbcTemplate jdbc;
    private final RlsContext rls;

    public TransferService(JdbcTemplate jdbc, RlsContext rls) {
        this.jdbc = jdbc;
        this.rls = rls;
    }

    @Transactional
    public UUID transfer(long customerId, String idempotencyKey,
                         String fromAccount, String toAccount, BigDecimal amount) {
        rls.bind(customerId);
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