package com.finshield.api;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.finshield.audit.AuditVerifier;

@RestController
@RequestMapping("/api/audit")
public class AuditController {

    public record AnchorResult(boolean matches) {
    }

    private final AuditVerifier verifier;
    private final JdbcTemplate jdbc;

    public AuditController(AuditVerifier verifier, JdbcTemplate jdbc) {
        this.verifier = verifier;
        this.jdbc = jdbc;
    }

    @GetMapping("/verify")
    public AuditVerifier.Result verify() {
        return verifier.verify();
    }

    @GetMapping("/anchor-check")
    public AnchorResult anchorCheck(@RequestParam long id, @RequestParam String hash) {
        return new AnchorResult(verifier.matchesAnchor(id, hash));
    }

    /** Returns up to 50 recent audit events as JSON for the chain visualiser. */
    @GetMapping("/events")
    public ResponseEntity<String> events() {
        String json = jdbc.queryForObject(
                """
                SELECT COALESCE(
                  json_agg(row_to_json(e) ORDER BY e.id DESC)::text,
                  '[]'
                )
                FROM (
                  SELECT id, event_type, actor, payload,
                         left(hash, 16) || '...' AS hash_preview,
                         hash,
                         left(prev_hash, 16) || '...' AS prev_hash_preview,
                         created_at
                  FROM audit_events
                  ORDER BY id DESC
                  LIMIT 50
                ) e
                """,
                String.class);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(json == null ? "[]" : json);
    }
}