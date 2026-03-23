package com.varzeastats.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RedefinirSenhaRequest {

    @NotBlank
    private String token;

    @NotBlank
    @Size(min = 6, max = 100)
    private String novaSenha;
}
