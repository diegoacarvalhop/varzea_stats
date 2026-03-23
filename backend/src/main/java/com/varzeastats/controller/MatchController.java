package com.varzeastats.controller;

import com.varzeastats.dto.MatchRequest;
import com.varzeastats.dto.MatchResponse;
import com.varzeastats.dto.MediaResponse;
import com.varzeastats.dto.OpenMatchResponse;
import com.varzeastats.security.PeladaResolver;
import com.varzeastats.service.MatchService;
import com.varzeastats.service.MediaService;
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
@RequestMapping("/matches")
@RequiredArgsConstructor
public class MatchController {

    private final MatchService matchService;
    private final MediaService mediaService;

    @GetMapping
    public ResponseEntity<List<MatchResponse>> list(
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.ok(matchService.findAll(peladaId));
    }

    @GetMapping("/open")
    public OpenMatchResponse getOpenMatch(@RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return new OpenMatchResponse(matchService.findCurrentOpenMatch(peladaId).orElse(null));
    }

    @GetMapping("/{matchId}/media")
    public ResponseEntity<List<MediaResponse>> listMediaForMatch(
            @PathVariable Long matchId, @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.ok(mediaService.listByMatch(matchId, peladaId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MatchResponse> get(
            @PathVariable Long id, @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.ok(matchService.findById(id, peladaId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','SCOUT','MEDIA')")
    public ResponseEntity<MatchResponse> create(
            @Valid @RequestBody MatchRequest request,
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(matchService.create(request, peladaId));
    }

    @PostMapping("/{id}/finish")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','SCOUT','MEDIA')")
    public ResponseEntity<MatchResponse> finish(
            @PathVariable Long id, @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.ok(matchService.finish(id, peladaId));
    }
}
