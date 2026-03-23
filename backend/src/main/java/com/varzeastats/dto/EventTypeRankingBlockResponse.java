package com.varzeastats.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventTypeRankingBlockResponse {

    private String eventType;
    private String label;
    private List<PlayerEventCountResponse> entries;
}
