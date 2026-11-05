package com.finshield.api;

import java.math.BigDecimal;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.finshield.security.CurrentUser;
import com.finshield.transfer.TransferService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/transfers")
public class TransferController {

    public record TransferRequest(
            @NotBlank @Size(max = 20) String fromAccount,
            @NotBlank @Size(max = 20) String toAccount,
            @NotNull @DecimalMin("0.0001") @Digits(integer = 15, fraction = 4) BigDecimal amount) {
    }

    public record TransferResponse(UUID transferId) {
    }

    private final TransferService transfers;

    public TransferController(TransferService transfers) {
        this.transfers = transfers;
    }

    @PostMapping
    public ResponseEntity<TransferResponse> create(@AuthenticationPrincipal Jwt jwt,
                                                   @RequestHeader("Idempotency-Key") String idempotencyKey,
                                                   @Valid @RequestBody TransferRequest req) {
        UUID id = transfers.transfer(CurrentUser.customerId(jwt), idempotencyKey,
                req.fromAccount(), req.toAccount(), req.amount());
        return ResponseEntity.status(HttpStatus.CREATED).body(new TransferResponse(id));
    }
}