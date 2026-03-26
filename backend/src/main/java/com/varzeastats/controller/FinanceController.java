package com.varzeastats.controller;

import com.varzeastats.dto.FinanceDelinquentRowResponse;
import com.varzeastats.dto.FinanceDelinquentReminderRequest;
import com.varzeastats.dto.FinanceMonthlyPaymentResponse;
import com.varzeastats.dto.FinanceReceiptResponse;
import com.varzeastats.dto.FinanceReceiptReviewRequest;
import com.varzeastats.dto.PaymentRecordRequest;
import com.varzeastats.security.AppUserDetails;
import com.varzeastats.service.FinanceService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

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

    @GetMapping("/payments/monthly")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','FINANCEIRO')")
    public ResponseEntity<List<FinanceMonthlyPaymentResponse>> monthlyPaymentsByUser(
            @RequestParam Long peladaId, @RequestParam Long userId, Authentication authentication) {
        return ResponseEntity.ok(
                financeService.listMonthlyPaymentsForUser(peladaId, userId, (AppUserDetails) authentication.getPrincipal()));
    }

    @GetMapping("/payments/monthly/my")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','FINANCEIRO','PLAYER')")
    public ResponseEntity<List<FinanceMonthlyPaymentResponse>> myMonthlyPayments(
            @RequestParam Long peladaId, Authentication authentication) {
        return ResponseEntity.ok(financeService.listMyMonthlyPayments(peladaId, (AppUserDetails) authentication.getPrincipal()));
    }

    @PostMapping(value = "/receipts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','FINANCEIRO','PLAYER')")
    public ResponseEntity<FinanceReceiptResponse> submitReceipt(
            @RequestParam Long peladaId,
            @RequestParam LocalDate paidAt,
            @RequestParam List<String> referenceMonths,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {
        return ResponseEntity.ok(financeService.submitMonthlyReceipt(
                peladaId, paidAt, referenceMonths, file, (AppUserDetails) authentication.getPrincipal()));
    }

    @GetMapping("/receipts/pending")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','FINANCEIRO')")
    public ResponseEntity<List<FinanceReceiptResponse>> pendingReceipts(
            @RequestParam Long peladaId, Authentication authentication) {
        return ResponseEntity.ok(financeService.listPendingReceipts(peladaId, (AppUserDetails) authentication.getPrincipal()));
    }

    @GetMapping("/receipts/user")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','FINANCEIRO','PLAYER')")
    public ResponseEntity<List<FinanceReceiptResponse>> receiptsByUser(
            @RequestParam Long peladaId, @RequestParam Long userId, Authentication authentication) {
        return ResponseEntity.ok(
                financeService.listReceiptsByUser(peladaId, userId, (AppUserDetails) authentication.getPrincipal()));
    }

    @PostMapping("/receipts/{receiptId}/approve")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','FINANCEIRO')")
    public ResponseEntity<Void> approveReceipt(
            @PathVariable Long receiptId,
            @Valid @RequestBody(required = false) FinanceReceiptReviewRequest request,
            Authentication authentication) {
        financeService.approveReceipt(receiptId, request != null ? request.getNote() : null, (AppUserDetails) authentication.getPrincipal());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/receipts/{receiptId}/reject")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','FINANCEIRO')")
    public ResponseEntity<Void> rejectReceipt(
            @PathVariable Long receiptId,
            @Valid @RequestBody(required = false) FinanceReceiptReviewRequest request,
            Authentication authentication) {
        financeService.rejectReceipt(receiptId, request != null ? request.getNote() : null, (AppUserDetails) authentication.getPrincipal());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/receipts/{receiptId}/file")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','FINANCEIRO','PLAYER')")
    public ResponseEntity<Resource> receiptFile(@PathVariable Long receiptId, Authentication authentication) {
        var loaded = financeService.loadReceiptFile(receiptId, (AppUserDetails) authentication.getPrincipal());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .contentType(MediaType.parseMediaType(loaded.contentType()))
                .body(loaded.resource());
    }
}
