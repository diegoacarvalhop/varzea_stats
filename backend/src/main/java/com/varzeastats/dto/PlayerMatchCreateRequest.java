package com.varzeastats.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PlayerMatchCreateRequest {

    @NotNull
    private Long teamId;

    @NotBlank
    private String name;

    /** Se true, o jogador é o goleiro desta equipe na partida. */
    private Boolean goalkeeper;
}
