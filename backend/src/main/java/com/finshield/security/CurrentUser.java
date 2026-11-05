package com.finshield.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

public final class CurrentUser {

    private CurrentUser() {
    }

    public static long customerId(Jwt jwt) {
        String cid = jwt.getClaimAsString("cid");
        if (cid == null) {
            throw new AccessDeniedException("token is not bound to a customer");
        }
        return Long.parseLong(cid);
    }
}