package com.varzeastats.controller;

import com.varzeastats.dto.EventInMatchRequest;
import com.varzeastats.dto.EventResponse;
import com.varzeastats.security.PeladaResolver;
import com.varzeastats.service.EventService;
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
@RequestMapping("/matches/{matchId}/events")
@RequiredArgsConstructor
public class MatchEventsController {

    private final EventService eventService;

    @GetMapping
    public ResponseEntity<List<EventResponse>> list(
            @PathVariable Long matchId,
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.ok(eventService.findByMatch(matchId, peladaId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','SCOUT','MEDIA')")
    public ResponseEntity<EventResponse> create(
            @PathVariable Long matchId,
            @Valid @RequestBody EventInMatchRequest request,
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(eventService.createForMatch(matchId, request, peladaId));
    }
}
