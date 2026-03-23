package com.varzeastats.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** Cadastro público de jogador: perfil fixo PLAYER e senha padrão do sistema. */
@Data
public class PublicRegistrationRequest {

    @NotBlank
    private String name;

    @NotBlank
    @Email
    private String email;

    @NotNull(message = "Escolha a pelada.")
    private Long peladaId;
}
