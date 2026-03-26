package com.varzeastats.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DraftPlayerSlotResponse {

    private Long userId;
    private String userName;
    private double skillScore;
    private boolean goalkeeper;
}
