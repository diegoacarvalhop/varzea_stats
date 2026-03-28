package com.varzeastats.controller;

import com.varzeastats.dto.PresenceSaveRequest;
import com.varzeastats.service.PresenceService;
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
@RequestMapping("/peladas/{peladaId}/presence")
@RequiredArgsConstructor
public class PeladaPresenceController {

    private final PresenceService presenceService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','SCOUT','MEDIA','FINANCEIRO')")
    public ResponseEntity<List<Long>> listPresent(
            @PathVariable Long peladaId,
            @RequestParam LocalDate date,
            Authentication authentication) {
        return ResponseEntity.ok(presenceService.listPresent(peladaId, date, authentication));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','SCOUT','MEDIA')")
    public ResponseEntity<Void> save(
            @PathVariable Long peladaId,
            @Valid @RequestBody PresenceSaveRequest body,
            Authentication authentication) {
        presenceService.save(peladaId, body, authentication);
        return ResponseEntity.ok().build();
    }
}
