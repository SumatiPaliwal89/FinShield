package com.finshield.api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.finshield.account.AccountQueryService;
import com.finshield.account.AccountQueryService.AccountView;
import com.finshield.account.AccountQueryService.LedgerView;
import com.finshield.security.CurrentUser;

@RestController
@RequestMapping("/api")
public class AccountController {

    private final AccountQueryService accounts;

    public AccountController(AccountQueryService accounts) {
        this.accounts = accounts;
    }

    @GetMapping("/accounts")
    public List<AccountView> list(@AuthenticationPrincipal Jwt jwt) {
        return accounts.list(CurrentUser.customerId(jwt));
    }

    @GetMapping("/accounts/{accountNumber}")
    public AccountView one(@AuthenticationPrincipal Jwt jwt, @PathVariable String accountNumber) {
        // Someone else's account is invisible through RLS, so it looks exactly like "doesn't exist".
        return accounts.find(CurrentUser.customerId(jwt), accountNumber)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    @GetMapping("/ledger")
    public List<LedgerView> ledger(@AuthenticationPrincipal Jwt jwt) {
        return accounts.ledger(CurrentUser.customerId(jwt));
    }
}