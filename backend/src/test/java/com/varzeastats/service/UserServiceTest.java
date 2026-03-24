package com.varzeastats.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.varzeastats.dto.PublicRegistrationRequest;
import com.varzeastats.dto.UserCreateRequest;
import com.varzeastats.dto.UserResponse;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.UserPeladaMembershipRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.security.AppUserDetails;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PeladaRepository peladaRepository;

    @Mock
    private UserPeladaMembershipRepository userPeladaMembershipRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    private Authentication authFor(User user) {
        AppUserDetails principal = new AppUserDetails(user);
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }

    @Test
    void create_player_asAdminGeral_assignsPelada() {
        User caller = User.builder()
                .id(1L)
                .name("AG")
                .email("ag@ag")
                .password("x")
                .roles(Set.of(Role.ADMIN_GERAL))
                .pelada(null)
                .build();
        UserCreateRequest req = new UserCreateRequest();
        req.setName("Novo");
        req.setEmail("novo@n.com");
        req.setRoles(List.of(Role.PLAYER));
        req.setPeladaId(7L);
        req.setPassword("definida123");

        when(userRepository.existsByEmail("novo@n.com")).thenReturn(false);
        when(passwordEncoder.encode("definida123")).thenReturn("{bcrypt}hash");
        when(userRepository.save(any(User.class)))
                .thenAnswer(inv -> {
                    User u = inv.getArgument(0);
                    u.setId(99L);
                    return u;
                });
        Pelada pelada = Pelada.builder().id(7L).name("Grupo").build();
        when(peladaRepository.findById(7L)).thenReturn(Optional.of(pelada));
        when(userPeladaMembershipRepository.findById_UserId(99L)).thenReturn(List.of());

        UserResponse out = userService.create(req, authFor(caller));

        assertThat(out.getEmail()).isEqualTo("novo@n.com");
        assertThat(out.getPeladaId()).isEqualTo(7L);
        verify(userRepository).save(any(User.class));
        verify(userPeladaMembershipRepository).deleteById_UserId(any());
    }

    @Test
    void create_combinedAdminGeralAndPlayer_throws() {
        User caller = User.builder()
                .id(1L)
                .name("AG")
                .email("ag@ag")
                .password("x")
                .roles(Set.of(Role.ADMIN_GERAL))
                .pelada(null)
                .build();
        UserCreateRequest req = new UserCreateRequest();
        req.setName("X");
        req.setEmail("x@x.com");
        req.setRoles(List.of(Role.ADMIN_GERAL, Role.PLAYER));
        req.setPassword("x");

        when(userRepository.existsByEmail("x@x.com")).thenReturn(false);

        assertThatThrownBy(() -> userService.create(req, authFor(caller)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("administrador geral");
    }

    @Test
    void create_adminGeralProfile_asPeladaAdmin_throws() {
        Pelada pelada = Pelada.builder().id(3L).name("Grupo").build();
        User caller = User.builder()
                .id(2L)
                .name("AP")
                .email("ap@ap")
                .password("x")
                .roles(Set.of(Role.ADMIN))
                .pelada(pelada)
                .build();
        UserCreateRequest req = new UserCreateRequest();
        req.setName("Novo AG");
        req.setEmail("novoag@x.com");
        req.setRoles(List.of(Role.ADMIN_GERAL));
        req.setPassword("x");

        when(userRepository.existsByEmail("novoag@x.com")).thenReturn(false);

        assertThatThrownBy(() -> userService.create(req, authFor(caller)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("administrador geral");
    }

    @Test
    void create_duplicateEmail_throws() {
        User caller = User.builder()
                .id(1L)
                .name("AG")
                .email("ag@ag")
                .password("x")
                .roles(Set.of(Role.ADMIN_GERAL))
                .pelada(null)
                .build();
        UserCreateRequest req = new UserCreateRequest();
        req.setName("X");
        req.setEmail("dup@dup.com");
        req.setRoles(List.of(Role.PLAYER));
        req.setPeladaId(1L);
        req.setPassword("x");

        when(userRepository.existsByEmail("dup@dup.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.create(req, authFor(caller)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("E-mail já cadastrado");
    }

    @Test
    void registerPublic_createsPlayerWithChosenPassword() {
        PublicRegistrationRequest req = new PublicRegistrationRequest();
        req.setName("  João  ");
        req.setEmail("  joao@pelada.com ");
        req.setPassword("minhasenha");

        when(userRepository.existsByEmail("joao@pelada.com")).thenReturn(false);
        when(passwordEncoder.encode("minhasenha")).thenReturn("{bcrypt}hash");
        when(userRepository.save(any(User.class)))
                .thenAnswer(inv -> {
                    User u = inv.getArgument(0);
                    u.setId(42L);
                    return u;
                });
        when(userPeladaMembershipRepository.findById_UserId(42L)).thenReturn(List.of());

        UserResponse out = userService.registerPublic(req);

        assertThat(out.getEmail()).isEqualTo("joao@pelada.com");
        assertThat(out.getPeladaId()).isNull();
        assertThat(out.getRoles()).containsExactly(Role.PLAYER);
        verify(userRepository).save(any(User.class));
    }

    @Test
    void registerPublic_duplicateEmail_throws() {
        PublicRegistrationRequest req = new PublicRegistrationRequest();
        req.setName("X");
        req.setEmail("dup@dup.com");
        req.setPassword("senha123");
        when(userRepository.existsByEmail("dup@dup.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.registerPublic(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("E-mail já cadastrado");
    }
}
