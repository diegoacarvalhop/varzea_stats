package com.varzeastats.dto;

import com.varzeastats.entity.EventType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventResponse {

    private Long id;
    private EventType type;
    private Long playerId;
    private Long targetId;
    private Long matchId;
}
