package com.varzeastats.controller;

import com.varzeastats.dto.PeladaCreateRequest;
import com.varzeastats.dto.PeladaResponse;
import com.varzeastats.security.AppUserDetails;
import com.varzeastats.service.PeladaService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/peladas")
@RequiredArgsConstructor
public class PeladaController {

    private final PeladaService peladaService;

    /**
     * ADMIN_GERAL: todas as peladas. Demais perfis autenticados: só a própria. Anônimo: todas (para escolher onde
     * acompanhar).
     */
    @GetMapping
    public ResponseEntity<List<PeladaResponse>> list(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof AppUserDetails u) {
            if (u.isAdminGeral()) {
                return ResponseEntity.ok(peladaService.findAll());
            }
            if (u.getPeladaId() != null) {
                return ResponseEntity.ok(List.of(peladaService.findById(u.getPeladaId())));
            }
        }
        return ResponseEntity.ok(peladaService.findAll());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('ADMIN_GERAL')")
    public ResponseEntity<PeladaResponse> createJson(@Valid @RequestBody PeladaCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(peladaService.create(request));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN_GERAL')")
    public ResponseEntity<PeladaResponse> createMultipart(
            @RequestPart("name") String name, @RequestPart(value = "logo", required = false) MultipartFile logo) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Nome da pelada é obrigatório.");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(peladaService.create(name.trim(), logo));
    }
}
