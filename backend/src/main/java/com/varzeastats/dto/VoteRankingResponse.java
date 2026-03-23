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
public class VoteRankingResponse {

    private List<VoteRankingEntryResponse> bolaCheia;
    private List<VoteRankingEntryResponse> bolaMurcha;
}
