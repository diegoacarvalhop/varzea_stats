package com.varzeastats.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeamScoreResponse {

    private Long teamId;
    private String teamName;
    private int goals;
}
