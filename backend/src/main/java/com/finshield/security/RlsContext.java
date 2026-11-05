package com.finshield.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class RlsContext {

    private final JdbcTemplate jdbc;

    public RlsContext(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Must be called inside a @Transactional method. Lasts only until the transaction ends. */
    public void bind(long customerId) {
        jdbc.queryForObject("SELECT set_config('app.customer_id', ?, true)",
                String.class, Long.toString(customerId));
    }
}