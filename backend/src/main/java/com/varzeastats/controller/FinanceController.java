package com.varzeastats.controller;

import com.varzeastats.dto.FinanceDelinquentRowResponse;
import com.varzeastats.dto.FinanceDelinquentReminderRequest;
import com.varzeastats.dto.PaymentRecordRequest;
import com.varzeastats.security.AppUserDetails;
import com.varzeastats.service.FinanceService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/finance")
@RequiredArgsConstructor
public class FinanceController {

    private final FinanceService financeService;

    @PostMapping("/payments")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','FINANCEIRO')")
    public ResponseEntity<Void> recordPayment(
            @Valid @RequestBody PaymentRecordRequest request, Authentication authentication) {
        financeService.recordPayment(request, (AppUserDetails) authentication.getPrincipal());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/delinquent")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','FINANCEIRO')")
    public ResponseEntity<List<FinanceDelinquentRowResponse>> delinquent(
            @RequestParam Long peladaId, Authentication authentication) {
        return ResponseEntity.ok(financeService.listDelinquents(
                peladaId, LocalDate.now(), (AppUserDetails) authentication.getPrincipal()));
    }

    @PostMapping("/delinquent/reminder")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','FINANCEIRO')")
    public ResponseEntity<Void> sendDelinquentReminder(
            @Valid @RequestBody FinanceDelinquentReminderRequest request, Authentication authentication) {
        financeService.sendDelinquentReminder(request, (AppUserDetails) authentication.getPrincipal());
        return ResponseEntity.ok().build();
    }
}
