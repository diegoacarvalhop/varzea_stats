package com.varzeastats.dto;

import com.varzeastats.entity.EventType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class EventInMatchRequest {

    @NotNull
    private EventType type;

    private Long playerId;

    private Long targetId;

    /** Segundos decorridos desde o início do período (cronômetro crescente). Opcional. */
    private Integer clockElapsedSeconds;
}
