package com.varzeastats.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import lombok.Data;

@Data
public class PeladaSettingsRequest {

    private Boolean active;
    private String location;
    /** Horário HH:mm (24h); vazio ou null limpa. */
    private String scheduleTime;
    /** Dias da semana ISO-8601 (1=Seg … 7=Dom); lista vazia limpa. */
    private List<@Min(1) @Max(7) Integer> scheduleWeekdays;
    private Integer monthlyFeeCents;
    private Integer dailyFeeCents;
    @Min(2)
    private Integer teamCount;
    private String teamNames;
    @Min(1)
    private Integer matchDurationMinutes;
    @Min(1)
    private Integer matchGoalsToEnd;
}
