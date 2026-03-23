package com.varzeastats.controller;

import com.varzeastats.dto.TeamCreateRequest;
import com.varzeastats.dto.TeamResponse;
import com.varzeastats.security.PeladaResolver;
import com.varzeastats.service.TeamService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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
@RequestMapping("/matches/{matchId}/teams")
@RequiredArgsConstructor
public class MatchTeamsController {

    private final TeamService teamService;

    @GetMapping
    public ResponseEntity<List<TeamResponse>> list(
            @PathVariable Long matchId,
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.ok(teamService.findByMatch(matchId, peladaId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','SCOUT')")
    public ResponseEntity<TeamResponse> create(
            @PathVariable Long matchId,
            @Valid @RequestBody TeamCreateRequest request,
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(teamService.createForMatch(matchId, request, peladaId));
    }
}
