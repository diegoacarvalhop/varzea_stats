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
public class PlayerTrajectoryResponse {

    /** Nome usado para agrupar cadastros em várias partidas. */
    private String groupedByPlayerName;

    private int matchesWithEvents;

    private List<TrajectoryMatchSliceResponse> byMatch;

    private List<TrajectoryCumulativePointResponse> cumulativeByMatch;

    private PlayerTrajectoryForecastResponse forecast;
}
