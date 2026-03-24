package com.varzeastats.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FinanceDelinquentReminderRequest {

    @NotNull
    private Long userId;

    @NotNull
    private Long peladaId;
}
