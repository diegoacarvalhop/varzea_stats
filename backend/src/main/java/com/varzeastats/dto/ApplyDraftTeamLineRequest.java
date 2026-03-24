package com.varzeastats.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import lombok.Data;

@Data
public class ApplyDraftTeamLineRequest {

    @NotBlank
    private String teamName;

    @NotEmpty
    @Valid
    private List<ApplyDraftSlotRequest> slots;
}
