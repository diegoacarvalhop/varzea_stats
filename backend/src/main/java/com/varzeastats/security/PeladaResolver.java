package com.varzeastats.security;

import com.varzeastats.repository.PeladaRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PeladaResolver {

    public static final String REQUEST_ATTR_PELADA_ID = "varzeaPeladaId";

    private final PeladaRepository peladaRepository;

    public long resolvePeladaId(HttpServletRequest request, Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof AppUserDetails u) {
            if (u.isAdminGeral()) {
                return parseHeaderRequired(request);
            }
            if (u.getPeladaId() == null) {
                throw new IllegalArgumentException(
                        "Seu perfil exige uma pelada associada. Peça ao administrador para vincular sua conta.");
            }
            return u.getPeladaId();
        }
        return parseHeaderRequired(request);
    }

    private long parseHeaderRequired(HttpServletRequest request) {
        String h = request.getHeader("X-Pelada-Id");
        if (h == null || h.isBlank()) {
            throw new IllegalArgumentException(
                    "Informe a pelada no cabeçalho X-Pelada-Id (administração geral escolhe qual pelada administrar).");
        }
        try {
            long id = Long.parseLong(h.trim());
            if (!peladaRepository.existsById(id)) {
                throw new IllegalArgumentException("Pelada não encontrada.");
            }
            return id;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("X-Pelada-Id inválido.");
        }
    }
}
