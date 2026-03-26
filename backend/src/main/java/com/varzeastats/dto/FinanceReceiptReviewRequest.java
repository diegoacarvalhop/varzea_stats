package com.varzeastats.dto;

import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import lombok.Data;

@Data
public class FinanceReceiptReviewRequest {

    @Size(max = 500)
    private String note;

    private LocalDate paidAt;
}
