package com.varzeastats.dto;

import com.varzeastats.entity.PaymentReceiptStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FinanceReceiptResponse {
    private Long id;
    private Long userId;
    private String userName;
    private Long peladaId;
    private LocalDate paidAt;
    private List<LocalDate> referenceMonths;
    private PaymentReceiptStatus status;
    private String originalFilename;
    private String contentType;
    private long fileSizeBytes;
    private Instant submittedAt;
    private Instant reviewedAt;
    private Long reviewedByUserId;
    private String reviewedByName;
    private String reviewNote;
}
