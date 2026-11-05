package com.finshield.transfer;

public class TransferException extends RuntimeException {

    public enum Reason {
        INSUFFICIENT_FUNDS("FS001"),
        DESTINATION_NOT_FOUND("FS002"),
        NOT_AUTHORIZED("FS003"),
        IDEMPOTENCY_CONFLICT("FS004"),
        INVALID_ACCOUNT_STATE("FS005"),
        INVALID_REQUEST("FS006");

        private final String sqlState;

        Reason(String sqlState) {
            this.sqlState = sqlState;
        }

        public static Reason fromSqlState(String state) {
            for (Reason r : values()) {
                if (r.sqlState.equals(state)) {
                    return r;
                }
            }
            return null;
        }
    }

    private final Reason reason;

    public TransferException(Reason reason, Throwable cause) {
        super(reason.name(), cause);
        this.reason = reason;
    }

    public Reason getReason() {
        return reason;
    }
}