package com.varzeastats.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PublicRegistrationRequest {

    @NotBlank
    private String name;

    @NotBlank
    @Email
    private String email;

    @NotBlank
    @Size(min = 6)
    private String password;

    /** Quando informado, o cadastro público entra como PLAYER nessa pelada. */
    private Long peladaId;

    /** Para cadastro de PLAYER: true=mensalista (R$15), false=diarista (R$10). */
    private Boolean billingMonthly;
}
