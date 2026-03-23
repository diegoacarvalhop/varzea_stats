package com.varzeastats.dto;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlayerDirectoryEntryResponse {

    private Long playerId;
    private String playerName;
    private String teamName;
    private Long matchId;
    private Instant matchDate;
    private String matchLocation;
    private boolean goalkeeper;
}
