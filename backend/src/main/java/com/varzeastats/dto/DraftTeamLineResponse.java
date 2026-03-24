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
public class DraftTeamLineResponse {

    private int teamIndex;
    private String teamName;
    private List<DraftPlayerSlotResponse> players;
}
