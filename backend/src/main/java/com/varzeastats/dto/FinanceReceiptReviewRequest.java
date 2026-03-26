package com.varzeastats.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class FinanceReceiptReviewRequest {

    @Size(max = 500)
    private String note;
}
