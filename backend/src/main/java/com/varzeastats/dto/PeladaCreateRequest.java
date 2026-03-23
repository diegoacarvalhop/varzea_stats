package com.varzeastats.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PeladaCreateRequest {

    @NotBlank
    @Size(max = 200)
    private String name;
}
