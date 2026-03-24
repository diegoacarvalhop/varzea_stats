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
public class PeladaPublicCardResponse {

    private Long id;
    private String name;
    private long playerCount;
    private String location;
    private String scheduleLabel;
    private Instant createdAt;
    private boolean hasLogo;
}
