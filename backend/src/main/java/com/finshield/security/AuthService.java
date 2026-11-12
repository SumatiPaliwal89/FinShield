package com.finshield.security;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    public static final Duration TOKEN_TTL = Duration.ofMinutes(60);

    private record UserRow(long id, Long customerId, String passwordHash, boolean enabled) {
    }

    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final JwtEncoder jwtEncoder;
    private final String dummyHash;

    public AuthService(JdbcTemplate jdbc, PasswordEncoder encoder, JwtEncoder jwtEncoder) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.jwtEncoder = jwtEncoder;
        this.dummyHash = encoder.encode("not-a-real-password");
    }

    // Deliberately NOT @Transactional: the failure log must commit even though we throw.
    public String login(String username, String password) {
        List<UserRow> rows = jdbc.query(
                "SELECT id, customer_id, password_hash, enabled FROM users WHERE username = ?",
                (rs, i) -> new UserRow(rs.getLong(1), (Long) rs.getObject(2),
                        rs.getString(3), rs.getBoolean(4)),
                username);
        UserRow user = rows.isEmpty() ? null : rows.get(0);

        // Always run one BCrypt comparison, so unknown users and wrong passwords take the same time.
        boolean passwordOk = encoder.matches(password, user != null ? user.passwordHash() : dummyHash);

        if (user == null || !passwordOk || !user.enabled()) {
            jdbc.update("INSERT INTO security_events(event_type, severity, details) "
                    + "VALUES ('LOGIN_FAILED', 'LOW', jsonb_build_object('username', ?::text))",
                    username.length() > 60 ? username.substring(0, 60) : username);
            throw new BadCredentialsException("Invalid credentials");
        }

        List<String> roles = jdbc.queryForList(
                "SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?",
                String.class, user.id());

        Instant now = Instant.now();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer("finshield")
                .subject(username)
                .issuedAt(now)
                .expiresAt(now.plus(TOKEN_TTL))
                .claim("roles", roles);
        if (user.customerId() != null) {
            claims.claim("cid", user.customerId());
        }
        return jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims.build())).getTokenValue();
    }
}