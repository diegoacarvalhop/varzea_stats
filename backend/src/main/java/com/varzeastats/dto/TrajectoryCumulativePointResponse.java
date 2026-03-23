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
public class TrajectoryCumulativePointResponse {

    private Long matchId;
    private Instant matchDate;
    private long cumulativeGoals;
    private long cumulativeAssists;
}
