package com.varzeastats.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlayerEventCountResponse {

    private Long playerId;
    private String playerName;
    private long eventCount;
}
