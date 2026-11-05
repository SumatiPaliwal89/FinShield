package com.finshield.lab;

import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finshield.security.RlsContext;

/**
 * Day 5 — Ethical Hacking Lab
 *
 * Each vulnerability is paired with its fix in the same class so the
 * before/after contrast is immediately visible.  The *Vuln methods must
 * never be reused outside the lab controller.
 */
@Service
public class LabService {

    private final JdbcTemplate jdbc;
    private final RlsContext rls;

    public LabService(JdbcTemplate jdbc, RlsContext rls) {
        this.jdbc = jdbc;
        this.rls = rls;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Vulnerability 1 — SQL Injection
    //
    // The endpoint sets no RLS context, so the customers table itself returns
    // no rows (app_customer_id() = NULL ⟹ policy is always false).  But a
    // UNION-based injection can reach tables that have no RLS — in particular
    // `users`, which holds bcrypt password hashes.
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * VULNERABLE — string concatenation; called from an unauthenticated endpoint.
     *
     * <p>Exploit payload: {@code x' UNION SELECT username, password_hash FROM users--}
     * <br>Result: all usernames and bcrypt hashes returned to an unauthenticated caller.
     */
    public List<Map<String, Object>> searchByNameVuln(String name) {
        // ⚠ INTENTIONAL FLAW — do not copy this pattern
        String sql = "SELECT full_name, email FROM customers WHERE full_name ILIKE '%" + name + "%'";
        return jdbc.queryForList(sql);
    }

    /**
     * FIXED — parameterised query; RLS context set from the validated JWT customer ID.
     * The injection payload becomes a literal string to match against, and even a
     * successful UNION attempt is blocked because the UNION branch would be treated as
     * part of the ILIKE pattern, not as SQL.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> searchByName(long customerId, String name) {
        rls.bind(customerId);
        String pattern = "%" + name.replace("\\", "\\\\")
                                   .replace("%", "\\%")
                                   .replace("_", "\\_") + "%";
        return jdbc.queryForList(
                "SELECT full_name, email FROM customers WHERE full_name ILIKE ? ESCAPE '\\'",
                pattern);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Vulnerability 2 — BOLA (Broken Object Level Authorization)
    //
    // The vulnerable endpoint accepts a customer ID from the URL path and uses
    // it to set the RLS context.  Any authenticated user can read any other
    // customer's profile by supplying a different ID.
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * VULNERABLE — binds RLS context to the caller-supplied {@code requestedId}
     * instead of the identity in the JWT.
     *
     * <p>Exploit: alice (cid=1) calls {@code GET /api/lab/customer/2/vuln} → reads
     * Bob's profile because {@code rls.bind(2)} satisfies Bob's RLS policy row.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> profileVuln(long requestedId) {
        // ⚠ INTENTIONAL FLAW — requestedId comes from the URL, not the JWT
        rls.bind(requestedId);
        return jdbc.queryForList(
                "SELECT full_name, email FROM customers WHERE id = ?", requestedId);
    }

    /**
     * FIXED — customer ID always comes from the JWT; the URL can carry no ID at all.
     * RLS and the WHERE clause both use the same trusted value.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> profile(long jwtCustomerId) {
        rls.bind(jwtCustomerId);
        return jdbc.queryForList(
                "SELECT full_name, email FROM customers WHERE id = ?", jwtCustomerId);
    }
}
