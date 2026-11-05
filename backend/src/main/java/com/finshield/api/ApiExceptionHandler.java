package com.finshield.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.finshield.transfer.TransferException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(TransferException.class)
    ProblemDetail onTransfer(TransferException e) {
        HttpStatus status = switch (e.getReason()) {
            case INSUFFICIENT_FUNDS, INVALID_ACCOUNT_STATE -> HttpStatus.UNPROCESSABLE_ENTITY;
            case DESTINATION_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case NOT_AUTHORIZED -> HttpStatus.FORBIDDEN;
            case IDEMPOTENCY_CONFLICT -> HttpStatus.CONFLICT;
            case INVALID_REQUEST -> HttpStatus.BAD_REQUEST;
        };
        return ProblemDetail.forStatusAndDetail(status, e.getReason().name());
    }

    @ExceptionHandler(BadCredentialsException.class)
    ProblemDetail onBadCredentials(BadCredentialsException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Invalid credentials");
    }
}