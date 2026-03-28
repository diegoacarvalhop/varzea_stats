package com.varzeastats.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatchResponse {

    private Long id;
    private Long peladaId;
    private Instant date;
    private String location;
    private Instant finishedAt;
    /** Preenchido quando a partida foi cancelada. */
    private Instant cancelledAt;
    /** IDs dos dois times do confronto (placar / listagens); nulos se ainda não definido. */
    private Long focusTeamAId;
    private Long focusTeamBId;
    private List<TeamScoreResponse> teamScores;
    /** Elenco (omitido na listagem {@code GET /matches} para resposta leve; presente no detalhe e após mutações). */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<PlayerResponse> players;
}
