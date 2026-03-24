package com.varzeastats.dto;

import com.varzeastats.entity.PaymentKind;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import lombok.Data;

@Data
public class PaymentRecordRequest {

    @NotNull
    private Long userId;

    @NotNull
    private Long peladaId;

    @NotNull
    private PaymentKind kind;

    @NotNull
    @Min(0)
    private Integer amountCents;

    @NotNull
    private LocalDate paidAt;

    @NotNull
    private LocalDate referenceMonth;
}
