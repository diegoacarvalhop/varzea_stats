package com.varzeastats.dto;

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
    private List<TeamScoreResponse> teamScores;
}
