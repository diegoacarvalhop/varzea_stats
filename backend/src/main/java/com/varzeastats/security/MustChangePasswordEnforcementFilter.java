package com.varzeastats.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Enquanto o JWT indicar {@code mustChangePassword}, só permite a chamada autenticada a
 * {@code POST /auth/change-password} (além de rotas públicas sem Bearer).
 */
@Component
@RequiredArgsConstructor
public class MustChangePasswordEnforcementFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }
        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        String jwt = auth.substring(7);
        try {
            if (jwtService.extractMustChangePassword(jwt)) {
                String path = request.getServletPath();
                boolean allowed =
                        "POST".equalsIgnoreCase(request.getMethod()) && "/auth/change-password".equals(path);
                if (!allowed) {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter()
                            .write("{\"message\":\"É necessário alterar sua senha antes de continuar.\"}");
                    return;
                }
            }
        } catch (Exception ignored) {
            // token inválido: segue a cadeia (outros filtros / 401)
        }
        filterChain.doFilter(request, response);
    }
}
