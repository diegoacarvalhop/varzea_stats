package com.varzeastats.controller;

import com.varzeastats.service.PeladaLogoStorageService.LoadedLogo;
import com.varzeastats.service.PeladaService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/peladas")
@RequiredArgsConstructor
public class PeladaLogoController {

    private final PeladaService peladaService;

    @GetMapping("/{id}/logo")
    public ResponseEntity<Resource> getLogo(@PathVariable Long id) {
        return peladaService
                .getLogo(id)
                .map(this::toResponse)
                .orElse(ResponseEntity.<Resource>notFound().build());
    }

    private ResponseEntity<Resource> toResponse(LoadedLogo loaded) {
        // Sem cache longo: a URL é /peladas/{id}/logo (fixa por id). Após trocar a imagem ou recriar a pelada
        // com o mesmo id, o navegador reutilizaria a resposta em cache (problema clássico).
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(loaded.contentType()))
                .cacheControl(CacheControl.noCache())
                .body(loaded.resource());
    }
}
