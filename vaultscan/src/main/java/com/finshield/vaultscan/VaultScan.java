package com.finshield.vaultscan;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HexFormat;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * VaultScan — standalone audit-chain verifier.
 *
 * <p>Connects directly to PostgreSQL as a DBA-level account and re-computes
 * every SHA-256 in the {@code audit_events} chain WITHOUT using the Spring
 * application.  Run it from a machine that has no copy of the app code to
 * get a fully independent verification.
 *
 * <p>Independence note: VaultScan fetches the canonical string via
 * {@code audit_canonical()}, the same Postgres function the app uses, so
 * its canonicalization step is not application-independent (the DB function
 * could in theory be tampered).  What IS independent is the SHA-256
 * computation and chain-link verification, which are done here in Java.
 * For a fully air-gapped verifier you would re-implement the JSONB
 * canonicalization in Java — noted as a future exercise in docs/vaultscan.md.
 *
 * <h2>Usage</h2>
 * <pre>
 *   java -jar vaultscan.jar &lt;jdbc-url&gt; &lt;user&gt; &lt;password&gt; [anchor.json]
 * </pre>
 *
 * <h2>Exit codes</h2>
 * <ul>
 *   <li>0 — chain intact (and anchor matches, when provided)
 *   <li>1 — chain broken, or anchor mismatch
 *   <li>2 — usage / connection error
 * </ul>
 */
public class VaultScan {

    static final String GENESIS = "0".repeat(64);

    // ── entry point ───────────────────────────────────────────────────────────

    public static void main(String[] args) {
        if (args.length < 3) {
            System.err.println("Usage: vaultscan <jdbc-url> <user> <password> [anchor.json]");
            System.exit(2);
        }
        String url        = args[0];
        String user       = args[1];
        String password   = args[2];
        String anchorPath = args.length >= 4 ? args[3] : null;

        ScanResult result;
        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            result = scan(conn);
        } catch (SQLException e) {
            System.err.println("Connection error: " + e.getMessage());
            System.exit(2);
            return;
        }

        // ── report chain result ───────────────────────────────────────────────

        if (result.valid()) {
            System.out.printf("[VaultScan] PASS  %d event(s) checked%n", result.eventsChecked());
            if (result.headId() != null) {
                System.out.printf("           head  id=%-6d  hash=%s%n",
                        result.headId(), result.headHash());
            } else {
                System.out.println("           chain is empty");
            }
        } else {
            System.out.printf("[VaultScan] FAIL  first broken id=%d%n", result.firstBrokenId());
            System.out.printf("           reason: %s%n", result.problem());
            System.exit(1);
        }

        // ── anchor check (optional) ───────────────────────────────────────────

        if (anchorPath != null) {
            Anchor anchor;
            try {
                anchor = loadAnchor(anchorPath);
            } catch (IOException e) {
                System.err.println("Cannot read anchor file: " + e.getMessage());
                System.exit(2);
                return;
            }
            boolean matches = anchor.headId().equals(result.headId())
                    && anchor.headHash().equals(result.headHash());
            if (matches) {
                System.out.printf("[VaultScan] ANCHOR MATCH  id=%d%n", anchor.headId());
            } else {
                System.out.printf("[VaultScan] ANCHOR MISMATCH%n");
                System.out.printf("           stored   id=%-6d  hash=%.16s…%n",
                        anchor.headId(), anchor.headHash());
                String currentHash = result.headHash() != null
                        ? result.headHash().substring(0, 16) + "…" : "(none)";
                System.out.printf("           current  id=%-6s  hash=%s%n",
                        result.headId() == null ? "(none)" : result.headId(), currentHash);
                System.exit(1);
            }
        }
    }

    // ── chain walk ────────────────────────────────────────────────────────────

    /**
     * Walks every event in ascending order and re-computes SHA-256 of its
     * canonical representation.  Returns as soon as a broken link is found.
     */
    public static ScanResult scan(Connection conn) throws SQLException {
        /*
         * audit_canonical(prev_hash, created_at, event_type, actor, payload)
         * returns the same JSON-array string the INSERT trigger used when it
         * originally computed the stored hash.
         */
        String sql = """
                SELECT id, prev_hash, hash,
                       audit_canonical(prev_hash::text, created_at,
                                       event_type::text, actor::text, payload) AS canonical
                FROM audit_events
                ORDER BY id
                """;
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setFetchSize(1000);                        // stream — don't load everything at once
            try (ResultSet rs = ps.executeQuery()) {
                String expectedPrev = GENESIS;
                long   checked      = 0;
                Long   headId       = null;
                String headHash     = null;

                while (rs.next()) {
                    long   id        = rs.getLong("id");
                    String prev      = rs.getString("prev_hash").trim();
                    String stored    = rs.getString("hash").trim();
                    String canonical = rs.getString("canonical");

                    // 1. Chain link: does this event's prev_hash equal the last event's hash?
                    if (!prev.equals(expectedPrev)) {
                        return new ScanResult(false, checked, headId, headHash, id,
                                "prev_hash mismatch — event removed, inserted, or reordered");
                    }

                    // 2. Content integrity: does recomputed hash equal the stored hash?
                    String computed = sha256(canonical);
                    if (!computed.equals(stored)) {
                        return new ScanResult(false, checked, headId, headHash, id,
                                "hash mismatch — event content was modified");
                    }

                    expectedPrev = stored;
                    checked++;
                    headId   = id;
                    headHash = stored;
                }
                return new ScanResult(true, checked, headId, headHash, null, null);
            }
        }
    }

    // ── utilities ─────────────────────────────────────────────────────────────

    public static String sha256(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Loads a JSON anchor file written by {@code GET /api/audit/verify}.
     * Format: {"valid":true,"eventsChecked":N,"headId":N,"headHash":"…", ...}
     */
    static Anchor loadAnchor(String path) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new FileReader(path))) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
        }
        String json    = sb.toString();
        long   headId  = Long.parseLong(extract(json, "headId"));
        String headHash = extract(json, "headHash");
        return new Anchor(headId, headHash);
    }

    private static String extract(String json, String key) {
        Matcher m = Pattern.compile(
                "\"" + key + "\"\\s*:\\s*(?:\"([^\"]+)\"|(-?\\d+))").matcher(json);
        if (!m.find()) throw new IllegalArgumentException("key not found in anchor JSON: " + key);
        return m.group(1) != null ? m.group(1) : m.group(2);
    }

    // ── result types ─────────────────────────────────────────────────────────

    public record ScanResult(
            boolean valid,
            long    eventsChecked,
            Long    headId,
            String  headHash,
            Long    firstBrokenId,
            String  problem) {}

    record Anchor(Long headId, String headHash) {}
}
