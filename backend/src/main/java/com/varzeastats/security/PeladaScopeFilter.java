package com.varzeastats.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Define o escopo da pelada atual para rotas de dados (partidas, stats, etc.). Administradores enviam
 * {@code X-Pelada-Id}; demais perfis usam a pelada da conta. Registrado na cadeia após o JWT.
 */
@RequiredArgsConstructor
public class PeladaScopeFilter extends OncePerRequestFilter {

    private final PeladaResolver peladaResolver;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!requiresPeladaContext(path)) {
            filterChain.doFilter(request, response);
            return;
        }
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            long peladaId = peladaResolver.resolvePeladaId(request, auth);
            request.setAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID, peladaId);
        } catch (IllegalArgumentException e) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            String msg = e.getMessage().replace("\"", "\\\"");
            response.getWriter().write("{\"error\":\"" + msg + "\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private static boolean requiresPeladaContext(String uri) {
        if (uri.startsWith("/actuator")
                || uri.startsWith("/v3/api-docs")
                || uri.startsWith("/swagger-ui")
                || uri.equals("/swagger-ui.html")) {
            return false;
        }
        if (uri.startsWith("/auth/")) {
            return false;
        }
        if (uri.startsWith("/users")) {
            return false;
        }
        if (uri.startsWith("/finance")) {
            return false;
        }
        if (uri.startsWith("/peladas")) {
            return false;
        }
        return uri.startsWith("/matches")
                || uri.startsWith("/players")
                || uri.startsWith("/stats")
                || uri.startsWith("/media");
    }
}
