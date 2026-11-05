package com.finshield.api;

import java.util.List;
import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.finshield.lab.LabService;
import com.finshield.security.CurrentUser;

/**
 * Day 5 — Ethical Hacking Lab controller.
 *
 * <ul>
 *   <li>{@code /vuln} variants are intentionally broken for the lab exercise.
 *   <li>The plain (unfixed) variants show the correct, production-ready approach.
 * </ul>
 *
 * Security config permits {@code /api/lab/profile/vuln} without a token to
 * simulate the realistic mistake of treating a "search" endpoint as public.
 */
@RestController
@RequestMapping("/api/lab")
public class LabController {

    private final LabService lab;

    public LabController(LabService lab) {
        this.lab = lab;
    }

    // ── Vulnerability 1: SQL Injection ─────────────────────────────────────

    /**
     * VULNERABLE: no authentication, SQL string concatenation.
     * SecurityConfig explicitly permits this path so the exploit can be demonstrated.
     */
    @GetMapping("/profile/vuln")
    public List<Map<String, Object>> profileSearchVuln(@RequestParam String name) {
        return lab.searchByNameVuln(name);
    }

    /**
     * FIXED: requires a valid JWT; uses a parameterised query with the caller's
     * RLS context so injection attempts are treated as literal search terms.
     */
    @GetMapping("/profile")
    public List<Map<String, Object>> profileSearch(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam String name) {
        return lab.searchByName(CurrentUser.customerId(jwt), name);
    }

    // ── Vulnerability 2: BOLA ──────────────────────────────────────────────

    /**
     * VULNERABLE: authenticated but uses the URL path ID to set the RLS context
     * instead of the identity from the JWT.  Any customer can read any other
     * customer's profile by supplying a different {@code id}.
     */
    @GetMapping("/customer/{id}/vuln")
    public List<Map<String, Object>> customerVuln(
            @PathVariable long id,
            @AuthenticationPrincipal Jwt jwt) {
        return lab.profileVuln(id);  // ← URL-supplied id, not from jwt
    }

    /**
     * FIXED: no path parameter at all.  The customer ID is always derived from
     * the JWT, making BOLA structurally impossible.
     */
    @GetMapping("/customer")
    public List<Map<String, Object>> customer(@AuthenticationPrincipal Jwt jwt) {
        return lab.profile(CurrentUser.customerId(jwt));
    }
}
