package com.varzeastats.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import lombok.Data;

@Data
public class MatchRequest {

    @NotNull
    private Instant date;

    @NotBlank
    private String location;
}
