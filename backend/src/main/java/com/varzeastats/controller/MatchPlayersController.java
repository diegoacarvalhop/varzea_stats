package com.varzeastats.controller;

import com.varzeastats.dto.ApplyDraftRosterRequest;
import com.varzeastats.dto.PlayerResponse;
import com.varzeastats.security.PeladaResolver;
import com.varzeastats.service.PlayerService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/matches/{matchId}/players")
@RequiredArgsConstructor
public class MatchPlayersController {

    private final PlayerService playerService;

    @GetMapping
    public ResponseEntity<List<PlayerResponse>> list(
            @PathVariable Long matchId,
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.ok(playerService.findByMatch(matchId, peladaId));
    }

    @PostMapping("/apply-draft")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','SCOUT')")
    public ResponseEntity<Void> applyDraft(
            @PathVariable Long matchId,
            @Valid @RequestBody ApplyDraftRosterRequest request,
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        playerService.applyDraftRoster(matchId, request, peladaId);
        return ResponseEntity.noContent().build();
    }
}
