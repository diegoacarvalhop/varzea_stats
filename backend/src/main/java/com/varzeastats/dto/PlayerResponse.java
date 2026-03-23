package com.varzeastats.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlayerResponse {

    private Long id;
    private String name;
    private Long teamId;
    private String teamName;
    private boolean goalkeeper;
}
