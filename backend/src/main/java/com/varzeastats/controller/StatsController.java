package com.varzeastats.controller;

import com.varzeastats.dto.LanceRankingsResponse;
import com.varzeastats.dto.PlayerStatsResponse;
import com.varzeastats.dto.PlayerTrajectoryResponse;
import com.varzeastats.dto.VoteRankingResponse;
import com.varzeastats.security.PeladaResolver;
import com.varzeastats.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    @GetMapping("/player/{id}/trajectory")
    public ResponseEntity<PlayerTrajectoryResponse> playerTrajectory(
            @PathVariable Long id, @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.ok(statsService.playerTrajectory(id, peladaId));
    }

    @GetMapping("/player/{id}")
    public ResponseEntity<PlayerStatsResponse> player(
            @PathVariable Long id, @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.ok(statsService.playerStats(id, peladaId));
    }

    @GetMapping("/ranking/votes")
    public ResponseEntity<VoteRankingResponse> voteRanking(
            @RequestParam(name = "limit", defaultValue = "20") int limit,
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.ok(statsService.voteRanking(limit, peladaId));
    }

    @GetMapping("/ranking/lances")
    public ResponseEntity<LanceRankingsResponse> lanceRankings(
            @RequestParam(name = "limit", defaultValue = "20") int limit,
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.ok(statsService.lanceRankings(limit, peladaId));
    }
}
