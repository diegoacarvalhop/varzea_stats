package com.varzeastats.dto;

import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlayerStatsResponse {

    private Long playerId;
    private String playerName;
    private Long teamId;
    private String teamName;
    private boolean goalkeeper;
    private long goalsConceded;
    private long foulsSuffered;
    private Map<String, Long> eventsByType;
}
