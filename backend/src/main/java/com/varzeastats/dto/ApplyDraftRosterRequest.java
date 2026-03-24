package com.varzeastats.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import lombok.Data;

@Data
public class ApplyDraftRosterRequest {

    @NotEmpty
    @Valid
    private List<ApplyDraftTeamLineRequest> lines;
}
