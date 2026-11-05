package com.finshield.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import com.finshield.AbstractDbTest;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApiSecurityTest extends AbstractDbTest {

    @Value("${local.server.port}")
    int port;

    final HttpClient http = HttpClient.newHttpClient();

    HttpResponse<String> call(String method, String path, String token, String idemKey, String json)
            throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (token != null) {
            b.header("Authorization", "Bearer " + token);
        }
        if (idemKey != null) {
            b.header("Idempotency-Key", idemKey);
        }
        if (json != null) {
            b.header("Content-Type", "application/json");
        }
        b.method(method, json == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json));
        return http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    static String loginJson(String user, String pass) {
        return "{\"username\":\"" + user + "\",\"password\":\"" + pass + "\"}";
    }

    static String field(String json, String name) {
        Matcher m = Pattern.compile("\"" + name + "\"\\s*:\\s*\"([^\"]+)\"").matcher(json);
        assertThat(m.find()).as("field '" + name + "' in " + json).isTrue();
        return m.group(1);
    }

    String login(String user, String pass) throws Exception {
        HttpResponse<String> r = call("POST", "/api/auth/login", null, null, loginJson(user, pass));
        assertThat(r.statusCode()).isEqualTo(200);
        return field(r.body(), "token");
    }

    static String transferJson(String from, String to, String amount) {
        return "{\"fromAccount\":\"" + from + "\",\"toAccount\":\"" + to + "\",\"amount\":" + amount + "}";
    }

    @Test
    void protectedEndpointsRejectRequestsWithoutToken() throws Exception {
        assertThat(call("GET", "/api/accounts", null, null, null).statusCode()).isEqualTo(401);
    }

    @Test
    void wrongPasswordAndUnknownUserLookIdenticalAndAreLogged() throws Exception {
        HttpResponse<String> wrongPass = call("POST", "/api/auth/login", null, null, loginJson("alice", "nope"));
        HttpResponse<String> noUser = call("POST", "/api/auth/login", null, null, loginJson("mallory", "nope"));

        assertThat(wrongPass.statusCode()).isEqualTo(401);
        assertThat(noUser.statusCode()).isEqualTo(401);
        assertThat(noUser.body()).isEqualTo(wrongPass.body());      // no username enumeration
        assertThat(count("SELECT count(*) FROM security_events WHERE event_type = 'LOGIN_FAILED'"))
                .isEqualTo(2);
    }

    @Test
    void customersSeeOnlyTheirOwnAccounts() throws Exception {
        String token = login("alice", "Alice#Dev2026");
        HttpResponse<String> r = call("GET", "/api/accounts", token, null, null);

        assertThat(r.statusCode()).isEqualTo(200);
        assertThat(r.body()).contains(A, B).doesNotContain(C);
    }

    @Test
    void readingSomeoneElsesAccountLooksLikeNotFound() throws Exception {
        String token = login("alice", "Alice#Dev2026");

        assertThat(call("GET", "/api/accounts/" + A, token, null, null).statusCode()).isEqualTo(200);
        assertThat(call("GET", "/api/accounts/" + C, token, null, null).statusCode()).isEqualTo(404);
    }

    @Test
    void transferEndpointIsIdempotentAndEnforcesOwnership() throws Exception {
        String alice = login("alice", "Alice#Dev2026");
        String body = transferJson(A, C, "250.00");

        HttpResponse<String> first = call("POST", "/api/transfers", alice, "idem-1", body);
        HttpResponse<String> replay = call("POST", "/api/transfers", alice, "idem-1", body);

        assertThat(first.statusCode()).isEqualTo(201);
        assertThat(replay.statusCode()).isEqualTo(201);
        assertThat(field(replay.body(), "transferId")).isEqualTo(field(first.body(), "transferId"));
        assertThat(balance(A)).isEqualByComparingTo("99750");

        String bob = login("bob", "Bob#Dev2026");
        HttpResponse<String> theft = call("POST", "/api/transfers", bob, "idem-2", transferJson(A, C, "10"));

        assertThat(theft.statusCode()).isEqualTo(403);
        assertThat(balance(A)).isEqualByComparingTo("99750");
    }

    @Test
    void transferWithoutIdempotencyKeyIsRejected() throws Exception {
        String alice = login("alice", "Alice#Dev2026");
        HttpResponse<String> r = call("POST", "/api/transfers", alice, null, transferJson(A, C, "10"));

        assertThat(r.statusCode()).isEqualTo(400);
    }

    @Test
    void tamperedTokenIsRejected() throws Exception {
        String token = login("alice", "Alice#Dev2026");
        int i = token.length() - 10;                         // a character inside the signature
        char swapped = token.charAt(i) == 'A' ? 'B' : 'A';
        String forged = token.substring(0, i) + swapped + token.substring(i + 1);

        assertThat(call("GET", "/api/accounts", forged, null, null).statusCode()).isEqualTo(401);
    }
    
    @Test
    void customersCannotReachAuditEndpoints() throws Exception {
        String alice = login("alice", "Alice#Dev2026");
        assertThat(call("GET", "/api/audit/verify", alice, null, null).statusCode()).isEqualTo(403);
    }

    @Test
    void auditorCanVerifyTheChain() throws Exception {
        String auditor = login("auditor", "Auditor#Dev2026");
        HttpResponse<String> r = call("GET", "/api/audit/verify", auditor, null, null);

        assertThat(r.statusCode()).isEqualTo(200);
        assertThat(r.body()).contains("\"valid\":true");
    }

    // Day 6: ZAP-required security headers are present on every response.
    @Test
    void securityHeadersArePresentOnEveryResponse() throws Exception {
        String token = login("alice", "Alice#Dev2026");
        HttpResponse<String> r = call("GET", "/api/accounts", token, null, null);

        assertThat(r.headers().firstValue("X-Content-Type-Options")).hasValue("nosniff");
        assertThat(r.headers().firstValue("X-Frame-Options")).hasValue("DENY");
        assertThat(r.headers().firstValue("Content-Security-Policy"))
                .hasValue("default-src 'none'");
        assertThat(r.headers().firstValue("Referrer-Policy")).hasValue("no-referrer");
    }
}