package com.varzeastats.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PlayerMatchCreateRequest {

    @NotNull
    private Long teamId;

    /**
     * Referência ao diretório da pelada: ID positivo = entidade {@code Player} de alguma partida desta pelada; ID
     * negativo = {@code -userId} do membro (tabela {@code user_pelada}) sem ficha em partida ainda.
     */
    @NotNull
    private Long directoryRef;

    /** Se true, o jogador é o goleiro desta equipe na partida. */
    private Boolean goalkeeper;
}
