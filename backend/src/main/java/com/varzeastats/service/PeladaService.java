package com.varzeastats.service;

import com.varzeastats.dto.PeladaCreateRequest;
import com.varzeastats.dto.PeladaResponse;
import com.varzeastats.entity.Pelada;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.service.PeladaLogoStorageService.LoadedLogo;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class PeladaService {

    private final PeladaRepository peladaRepository;
    private final PeladaLogoStorageService peladaLogoStorageService;

    @Transactional(readOnly = true)
    public List<PeladaResponse> findAll() {
        return peladaRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PeladaResponse findById(Long id) {
        Pelada p = peladaRepository
                .findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada"));
        return toResponse(p);
    }

    @Transactional
    public PeladaResponse create(PeladaCreateRequest request) {
        return create(request.getName().trim(), null);
    }

    @Transactional
    public PeladaResponse create(String name, MultipartFile logoFile) {
        Pelada p = Pelada.builder()
                .name(name)
                .createdAt(Instant.now())
                .build();
        p = peladaRepository.save(p);
        if (logoFile != null && !logoFile.isEmpty()) {
            String old = p.getLogoFileName();
            if (old != null && !old.isBlank()) {
                peladaLogoStorageService.deleteIfExists(old);
            }
            String stored = peladaLogoStorageService.storeLogo(p.getId(), logoFile);
            p.setLogoFileName(stored);
            p = peladaRepository.save(p);
        }
        return toResponse(p);
    }

    @Transactional(readOnly = true)
    public Optional<LoadedLogo> getLogo(Long peladaId) {
        return peladaRepository
                .findById(peladaId)
                .filter(p -> p.getLogoFileName() != null && !p.getLogoFileName().isBlank())
                .flatMap(p -> peladaLogoStorageService.load(p.getLogoFileName()));
    }

    private PeladaResponse toResponse(Pelada p) {
        boolean hasLogo = p.getLogoFileName() != null && !p.getLogoFileName().isBlank();
        return PeladaResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .createdAt(p.getCreatedAt())
                .hasLogo(hasLogo)
                .build();
    }
}
