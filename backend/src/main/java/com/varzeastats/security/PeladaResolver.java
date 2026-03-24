package com.varzeastats.security;

import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.UserPeladaMembershipRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PeladaResolver {

    public static final String REQUEST_ATTR_PELADA_ID = "varzeaPeladaId";

    private final PeladaRepository peladaRepository;
    private final UserPeladaMembershipRepository userPeladaMembershipRepository;

    public long resolvePeladaId(HttpServletRequest request, Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof AppUserDetails u) {
            if (u.isAdminGeral()) {
                return parseHeaderRequired(request);
            }
            Long headerId = parseHeaderOptional(request);
            long target;
            if (headerId != null) {
                target = headerId;
            } else if (u.getPeladaId() != null) {
                target = u.getPeladaId();
            } else {
                throw new IllegalArgumentException("Informe a pelada no cabeçalho X-Pelada-Id.");
            }
            if (!peladaRepository.existsById(target)) {
                throw new IllegalArgumentException("Pelada não encontrada.");
            }
            if (!userPeladaMembershipRepository.existsById_UserIdAndId_PeladaId(u.getUserId(), target)) {
                throw new IllegalArgumentException("Você não participa desta pelada.");
            }
            return target;
        }
        return parseHeaderRequired(request);
    }

    private long parseHeaderRequired(HttpServletRequest request) {
        Long id = parseHeaderOptional(request);
        if (id == null) {
            throw new IllegalArgumentException(
                    "Informe a pelada no cabeçalho X-Pelada-Id (administração geral escolhe qual pelada administrar).");
        }
        return id;
    }

    private Long parseHeaderOptional(HttpServletRequest request) {
        String h = request.getHeader("X-Pelada-Id");
        if (h == null || h.isBlank()) {
            return null;
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
