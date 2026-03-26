package com.varzeastats.dto;

import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FinanceMonthlyPaymentResponse {

    private Long id;
    private Long userId;
    private String userName;
    private String userEmail;
    private Long peladaId;
    private String peladaName;
    private Integer amountCents;
    private LocalDate paidAt;
    private LocalDate referenceMonth;
    private Long receiptId;
}
