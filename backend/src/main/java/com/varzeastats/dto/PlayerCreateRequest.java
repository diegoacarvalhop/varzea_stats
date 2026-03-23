package com.varzeastats.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PlayerCreateRequest {

    @NotBlank
    private String name;

    private Long teamId;
}
