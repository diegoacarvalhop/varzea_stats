package com.varzeastats.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ApplyDraftSlotRequest {

    @NotNull
    private Long userId;

    private Boolean goalkeeper;
}
