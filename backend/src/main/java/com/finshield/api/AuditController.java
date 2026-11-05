package com.finshield.api;

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

    public AuditController(AuditVerifier verifier) {
        this.verifier = verifier;
    }

    @GetMapping("/verify")
    public AuditVerifier.Result verify() {
        return verifier.verify();
    }

    @GetMapping("/anchor-check")
    public AnchorResult anchorCheck(@RequestParam long id, @RequestParam String hash) {
        return new AnchorResult(verifier.matchesAnchor(id, hash));
    }
}