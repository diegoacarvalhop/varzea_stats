package com.varzeastats.controller;

import com.varzeastats.dto.DraftRunRequest;
import com.varzeastats.dto.DraftTeamLineResponse;
import com.varzeastats.security.AppUserDetails;
import com.varzeastats.service.DraftService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/peladas/{peladaId}/draft")
@RequiredArgsConstructor
public class PeladaDraftController {

    private final DraftService draftService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','SCOUT','MEDIA')")
    public ResponseEntity<List<DraftTeamLineResponse>> run(
            @PathVariable Long peladaId,
            @Valid @RequestBody DraftRunRequest body,
            Authentication authentication) {
        AppUserDetails u = (AppUserDetails) authentication.getPrincipal();
        return ResponseEntity.ok(draftService.run(peladaId, body, u));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','SCOUT','MEDIA')")
    public ResponseEntity<List<DraftTeamLineResponse>> get(
            @PathVariable Long peladaId, @RequestParam LocalDate date, Authentication authentication) {
        AppUserDetails u = (AppUserDetails) authentication.getPrincipal();
        return ResponseEntity.ok(draftService.lastResult(peladaId, date, u));
    }
}
