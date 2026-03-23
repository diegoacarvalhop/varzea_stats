package com.varzeastats.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.repository.PeladaRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

@ExtendWith(MockitoExtension.class)
class PeladaResolverTest {

    @Mock
    private PeladaRepository peladaRepository;

    @Mock
    private HttpServletRequest request;

    @InjectMocks
    private PeladaResolver peladaResolver;

    private AppUserDetails adminGeralUser() {
        User u = User.builder()
                .id(1L)
                .name("Admin")
                .email("a@a")
                .password("x")
                .roles(Set.of(Role.ADMIN_GERAL))
                .pelada(null)
                .build();
        return new AppUserDetails(u);
    }

    private AppUserDetails scoutWithPelada(long peladaId) {
        Pelada p = Pelada.builder().id(peladaId).name("Pelada").build();
        User u = User.builder()
                .id(2L)
                .name("Scout")
                .email("s@s")
                .password("x")
                .roles(Set.of(Role.SCOUT))
                .pelada(p)
                .build();
        return new AppUserDetails(u);
    }

    @BeforeEach
    void headerDefaults() {
        when(request.getHeader("X-Pelada-Id")).thenReturn("10");
    }

    @Test
    void resolve_anonymous_usesHeaderAndValidatesPelada() {
        when(peladaRepository.existsById(10L)).thenReturn(true);

        long id = peladaResolver.resolvePeladaId(request, null);

        assertThat(id).isEqualTo(10L);
        verify(peladaRepository).existsById(10L);
    }

    @Test
    void resolve_adminGeral_usesHeader() {
        when(peladaRepository.existsById(10L)).thenReturn(true);
        Authentication auth = new UsernamePasswordAuthenticationToken(adminGeralUser(), null, null);

        assertThat(peladaResolver.resolvePeladaId(request, auth)).isEqualTo(10L);
    }

    @Test
    void resolve_scout_ignoresHeader_usesAccountPelada() {
        Authentication auth = new UsernamePasswordAuthenticationToken(scoutWithPelada(99L), null, null);

        assertThat(peladaResolver.resolvePeladaId(request, auth)).isEqualTo(99L);
    }

    @Test
    void resolve_missingHeader_throws() {
        when(request.getHeader("X-Pelada-Id")).thenReturn(null);
        Authentication auth = new UsernamePasswordAuthenticationToken(adminGeralUser(), null, null);

        assertThatThrownBy(() -> peladaResolver.resolvePeladaId(request, auth))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("X-Pelada-Id");
    }

    @Test
    void resolve_unknownPelada_throws() {
        when(peladaRepository.existsById(10L)).thenReturn(false);
        Authentication auth = new UsernamePasswordAuthenticationToken(adminGeralUser(), null, null);

        assertThatThrownBy(() -> peladaResolver.resolvePeladaId(request, auth))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Pelada não encontrada");
    }
}
