package com.finshield.lab;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import com.finshield.AbstractDbTest;

/**
 * Day 5 — Ethical Hacking Lab
 *
 * <p>Structure:
 * <ol>
 *   <li>EXPLOIT tests — prove the vulnerability is real and reproducible.
 *   <li>RETEST tests — prove the fix closes the attack vector.
 * </ol>
 *
 * Seed data: Alice Synthetic = customer 1, Bob Synthetic = customer 2.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class EthicalHackingLabTest extends AbstractDbTest {

    @Value("${local.server.port}")
    int port;

    final HttpClient http = HttpClient.newHttpClient();

    // ── helpers ──────────────────────────────────────────────────────────────

    HttpResponse<String> get(String path, String token) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(
                URI.create("http://localhost:" + port + path)).GET();
        if (token != null) b.header("Authorization", "Bearer " + token);
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    String login(String user, String pass) throws Exception {
        String json = "{\"username\":\"" + user + "\",\"password\":\"" + pass + "\"}";
        HttpResponse<String> r = http.send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/login"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(json))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(r.statusCode()).as("login for %s", user).isEqualTo(200);
        Matcher m = Pattern.compile("\"token\":\"([^\"]+)\"").matcher(r.body());
        assertThat(m.find()).isTrue();
        return m.group(1);
    }

    static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // EXPLOIT TESTS
    // prove the attack works against the vulnerable endpoints
    // ══════════════════════════════════════════════════════════════════════════

    // ── Exploit A: SQL Injection via unauthenticated profile search ───────────

    /**
     * The vulnerable endpoint is reachable without a JWT because the developer
     * added it to the SecurityConfig permit-all list, thinking search is public data.
     */
    @Test
    void exploit_A1_profileVulnAccessibleWithoutToken() throws Exception {
        HttpResponse<String> r = get("/api/lab/profile/vuln?name=anything", null);
        // 200 (not 401) proves the endpoint is publicly reachable
        assertThat(r.statusCode()).isEqualTo(200);
    }

    /**
     * UNION-based injection escapes the ILIKE string into a second SELECT against
     * the {@code users} table, which carries no RLS policy.  The result leaks
     * every username and bcrypt password hash to an unauthenticated caller.
     *
     * <p>Payload: {@code x' UNION SELECT username, password_hash FROM users--}
     * <p>Resulting SQL (after string concat):
     * <pre>
     *   SELECT full_name, email FROM customers WHERE full_name ILIKE '%x'
     *   UNION SELECT username, password_hash FROM users--'%'
     * </pre>
     * The first SELECT returns no rows (RLS policy: id = NULL is always false).
     * The second SELECT returns all rows from users (no RLS on that table).
     */
    @Test
    void exploit_A2_unionInjectionLeaksPasswordHashes() throws Exception {
        String payload = "x' UNION SELECT username, password_hash FROM users--";

        HttpResponse<String> r = get("/api/lab/profile/vuln?name=" + encode(payload), null);

        assertThat(r.statusCode()).isEqualTo(200);
        // BCrypt hashes always start with $2a$ or $2b$
        assertThat(r.body())
                .as("response should contain BCrypt hashes from the users table")
                .contains("$2");
        // All seeded usernames are in the leaked data
        assertThat(r.body()).contains("alice", "bob", "carol", "auditor");
    }

    // ── Exploit B: BOLA — Alice reads Bob's customer profile ─────────────────

    /**
     * Alice (customer 1) supplies path id=2 to the vulnerable endpoint.
     * The service blindly calls {@code rls.bind(2)}, satisfying Bob's RLS row
     * filter, and Bob's profile is returned to Alice.
     */
    @Test
    void exploit_B1_bolaAliceReadsBobbsProfile() throws Exception {
        String aliceToken = login("alice", "Alice#Dev2026");

        HttpResponse<String> r = get("/api/lab/customer/2/vuln", aliceToken);

        assertThat(r.statusCode()).isEqualTo(200);
        assertThat(r.body())
                .as("Alice's token should NOT be able to fetch Bob's data, but it does")
                .contains("Bob Synthetic");
    }

    /**
     * The BOLA works across any customer boundary — Alice can also read Carol's data.
     */
    @Test
    void exploit_B2_bolaAliceReadsCarolsProfile() throws Exception {
        String aliceToken = login("alice", "Alice#Dev2026");

        HttpResponse<String> r = get("/api/lab/customer/3/vuln", aliceToken);

        assertThat(r.statusCode()).isEqualTo(200);
        assertThat(r.body()).contains("Carol Synthetic");
    }

    // ══════════════════════════════════════════════════════════════════════════
    // RETEST — fixed endpoints must withstand the same attacks
    // ══════════════════════════════════════════════════════════════════════════

    // ── Fix A: parameterised query + authentication ───────────────────────────

    /**
     * The fixed profile search requires a valid JWT.  The same call that
     * succeeded against the vulnerable endpoint now returns 401.
     */
    @Test
    void fix_A1_safeProfileRequiresAuthentication() throws Exception {
        HttpResponse<String> r = get("/api/lab/profile?name=alice", null);
        assertThat(r.statusCode()).isEqualTo(401);
    }

    /**
     * When Alice sends the UNION injection payload to the fixed endpoint, it is
     * treated as a literal string and matched against full_name — no match, empty
     * list returned.  No password hashes leak.
     */
    @Test
    void fix_A2_injectionPayloadTreatedAsLiteralString() throws Exception {
        String aliceToken = login("alice", "Alice#Dev2026");
        String payload = "x' UNION SELECT username, password_hash FROM users--";

        HttpResponse<String> r = get("/api/lab/profile?name=" + encode(payload), aliceToken);

        assertThat(r.statusCode()).isEqualTo(200);
        assertThat(r.body())
                .as("no BCrypt hashes should be in the response")
                .doesNotContain("$2");
        assertThat(r.body()).isEqualTo("[]");
    }

    /**
     * A legitimate search by name works correctly — Alice finds her own record
     * and cannot see any other customer's data, even if the name matches.
     */
    @Test
    void fix_A3_legitimateSearchReturnsOnlyCallerOwnProfile() throws Exception {
        String aliceToken = login("alice", "Alice#Dev2026");

        HttpResponse<String> r = get("/api/lab/profile?name=Synthetic", aliceToken);

        // "Synthetic" matches all three customers, but RLS restricts results to Alice's row.
        assertThat(r.statusCode()).isEqualTo(200);
        assertThat(r.body()).contains("Alice Synthetic");
        assertThat(r.body()).doesNotContain("Bob Synthetic", "Carol Synthetic");
    }

    // ── Fix B: customer ID always from JWT ───────────────────────────────────

    /**
     * The fixed {@code GET /api/lab/customer} endpoint returns the caller's own
     * profile regardless of any other input — there is no ID in the URL.
     */
    @Test
    void fix_B1_safeEndpointAlwaysReturnsCallerProfile() throws Exception {
        String aliceToken = login("alice", "Alice#Dev2026");

        HttpResponse<String> r = get("/api/lab/customer", aliceToken);

        assertThat(r.statusCode()).isEqualTo(200);
        assertThat(r.body()).contains("Alice Synthetic");
        assertThat(r.body()).doesNotContain("Bob Synthetic");
    }

    /**
     * Each customer sees exactly their own data — BOLA is structurally impossible
     * because the service layer derives the ID from the JWT, not the URL.
     */
    @Test
    void fix_B2_eachCallerSeesOnlyTheirOwnProfile() throws Exception {
        String aliceToken = login("alice", "Alice#Dev2026");
        String bobToken   = login("bob",   "Bob#Dev2026");
        String carolToken = login("carol", "Carol#Dev2026");

        HttpResponse<String> alice = get("/api/lab/customer", aliceToken);
        HttpResponse<String> bob   = get("/api/lab/customer", bobToken);
        HttpResponse<String> carol = get("/api/lab/customer", carolToken);

        assertThat(alice.body()).contains("Alice Synthetic").doesNotContain("Bob", "Carol");
        assertThat(bob.body()).contains("Bob Synthetic").doesNotContain("Alice", "Carol");
        assertThat(carol.body()).contains("Carol Synthetic").doesNotContain("Alice", "Bob");
    }

    /**
     * The fixed endpoint requires authentication — no token means 401.
     */
    @Test
    void fix_B3_safeCustomerEndpointRequiresAuthentication() throws Exception {
        HttpResponse<String> r = get("/api/lab/customer", null);
        assertThat(r.statusCode()).isEqualTo(401);
    }
}
