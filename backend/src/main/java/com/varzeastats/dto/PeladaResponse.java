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
public class PeladaResponse {

    private Long id;
    private String name;
    private Instant createdAt;
    /** Indica se existe imagem em GET /peladas/{id}/logo */
    private boolean hasLogo;

    private boolean active;
    private String location;
    /** Texto para exibição (dias + horário ou legado). */
    private String scheduleLabel;
    private String scheduleTime;
    private List<Integer> scheduleWeekdays;
    /** Texto livre antigo quando ainda não há dias/horário estruturados. */
    private String scheduleLegacyLabel;
    private Integer monthlyFeeCents;
    private Integer dailyFeeCents;
    private Integer teamCount;
    private String teamNames;
    private Integer matchDurationMinutes;
    private Integer matchGoalsToEnd;
}
