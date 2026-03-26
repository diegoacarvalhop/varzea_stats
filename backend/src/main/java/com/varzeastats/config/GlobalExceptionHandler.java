package com.varzeastats.config;

import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> validation(MethodArgumentNotValidException ex) {
        FieldError fe = ex.getBindingResult().getFieldError();
        String msg = fe != null ? fe.getDefaultMessage() : "Dados inválidos";
        return ResponseEntity.badRequest().body(Map.of("error", msg));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, String>> unauthorized(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Credenciais inválidas"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> forbidden(AccessDeniedException ex) {
        String msg = ex.getMessage() != null && !ex.getMessage().isBlank() ? ex.getMessage() : "Acesso negado";
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", msg));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> dataIntegrity(DataIntegrityViolationException ex) {
        String cause = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : "";
        String msg = "Operação rejeitada: conflito com dados já existentes.";
        if (cause != null && cause.contains("idx_peladas_unique_name_normalized")) {
            msg = "Já existe uma pelada com este nome.";
        }
        return ResponseEntity.badRequest().body(Map.of("error", msg));
    }
}
