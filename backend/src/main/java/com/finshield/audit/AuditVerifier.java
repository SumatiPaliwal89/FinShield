package com.finshield.audit;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.PreparedStatement;
import java.util.HexFormat;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditVerifier {

    public static final String GENESIS = "0".repeat(64);

    public record Result(boolean valid, long eventsChecked, Long headId, String headHash,
                         Long firstBrokenId, String problem) {
    }

    private static final String SQL = """
            SELECT id, prev_hash, hash,
                   audit_canonical(prev_hash::text, created_at, event_type::text, actor::text, payload) AS canonical
            FROM audit_events ORDER BY id""";

    private final JdbcTemplate jdbc;

    public AuditVerifier(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Walks the whole chain from the first event and re-computes every hash. */
    @Transactional(readOnly = true)
    public Result verify() {
        return jdbc.query(con -> {
            PreparedStatement ps = con.prepareStatement(SQL);
            ps.setFetchSize(1000);                      // stream rows instead of loading them all
            return ps;
        }, (ResultSetExtractor<Result>) rs -> {
            String expectedPrev = GENESIS;
            long checked = 0;
            Long headId = null;
            String headHash = null;
            while (rs.next()) {
                long id = rs.getLong("id");
                String prev = rs.getString("prev_hash").trim();
                String hash = rs.getString("hash").trim();

                if (!prev.equals(expectedPrev)) {
                    return new Result(false, checked, headId, headHash, id,
                            "prev_hash does not match the previous event (event removed, inserted or reordered)");
                }
                if (!sha256Hex(rs.getString("canonical")).equals(hash)) {
                    return new Result(false, checked, headId, headHash, id,
                            "hash mismatch (event content was modified)");
                }
                expectedPrev = hash;
                checked++;
                headId = id;
                headHash = hash;
            }
            return new Result(true, checked, headId, headHash, null, null);
        });
    }

    /** Compares an externally stored checkpoint (id + hash) with what the database holds now. */
    @Transactional(readOnly = true)
    public boolean matchesAnchor(long id, String expectedHash) {
        List<String> rows = jdbc.queryForList("SELECT hash FROM audit_events WHERE id = ?", String.class, id);
        return rows.size() == 1 && rows.get(0).trim().equals(expectedHash);
    }

    public static String sha256Hex(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}