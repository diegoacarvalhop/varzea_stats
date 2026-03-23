package com.varzeastats.dto;

import com.varzeastats.entity.VoteType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class VoteRequest {

    @NotNull
    private Long playerId;

    @NotNull
    private VoteType type;
}
