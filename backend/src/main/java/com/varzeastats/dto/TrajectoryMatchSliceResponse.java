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
public class TrajectoryMatchSliceResponse {

    private Long matchId;
    private Instant matchDate;
    private String matchLocation;
    private long goals;
    private long ownGoals;
    private long assists;
    private long yellowCards;
    private long redCards;
    private long blueCards;
    private long fouls;
    private long foulsSuffered;
    private long otherEvents;
    private long goalsConceded;
}
