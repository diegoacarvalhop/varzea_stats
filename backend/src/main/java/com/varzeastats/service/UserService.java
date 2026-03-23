package com.varzeastats.service;

import com.varzeastats.dto.PublicRegistrationRequest;
import com.varzeastats.dto.UserCreateRequest;
import com.varzeastats.dto.UserResponse;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.security.AppUserDetails;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.EnumSet;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PeladaRepository peladaRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${varzea.user.default-password:123456}")
    private String defaultPassword;

    @Transactional(readOnly = true)
    public List<UserResponse> listForPrincipal(Authentication authentication) {
        AppUserDetails caller = (AppUserDetails) authentication.getPrincipal();
        if (caller.isAdminGeral()) {
            return userRepository.findAll(Sort.by(Sort.Direction.ASC, "email")).stream()
                    .map(this::toResponse)
                    .toList();
        }
        if (caller.hasRole(Role.ADMIN)) {
            Long pid = caller.getPeladaId();
            if (pid == null) {
                return List.of();
            }
            return userRepository.findAllByPelada_Id(pid, Sort.by(Sort.Direction.ASC, "email")).stream()
                    .map(this::toResponse)
                    .toList();
        }
        throw new AccessDeniedException("Sem permissão para listar usuários.");
    }

    @Transactional
    public UserResponse create(UserCreateRequest request, Authentication authentication) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("E-mail já cadastrado");
        }
        LinkedHashSet<Role> roleSet = new LinkedHashSet<>(request.getRoles());
        validateRoleCombination(roleSet);
        AppUserDetails caller = (AppUserDetails) authentication.getPrincipal();
        enforceCreateRules(caller, roleSet, request.getPeladaId());
        Pelada pelada = resolvePeladaForRoles(roleSet, request.getPeladaId());
        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(defaultPassword))
                .mustChangePassword(true)
                .roles(new LinkedHashSet<>(roleSet))
                .pelada(pelada)
                .build();
        user = userRepository.save(user);
        return toResponse(user);
    }

    /**
     * Autoatendimento na tela de login: cria conta só com perfil {@link Role#PLAYER}, senha padrão e
     * {@code mustChangePassword=true}.
     */
    @Transactional
    public UserResponse registerPublic(PublicRegistrationRequest request) {
        String email = request.getEmail().trim();
        if (email.isEmpty()) {
            throw new IllegalArgumentException("E-mail é obrigatório.");
        }
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("E-mail já cadastrado");
        }
        Pelada pelada = peladaRepository
                .findById(request.getPeladaId())
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
        LinkedHashSet<Role> roles = new LinkedHashSet<>(EnumSet.of(Role.PLAYER));
        User user = User.builder()
                .name(request.getName().trim())
                .email(email)
                .password(passwordEncoder.encode(defaultPassword))
                .mustChangePassword(true)
                .roles(roles)
                .pelada(pelada)
                .build();
        user = userRepository.save(user);
        return toResponse(user);
    }

    private static void validateRoleCombination(Set<Role> roles) {
        if (roles.isEmpty()) {
            throw new IllegalArgumentException("Informe pelo menos um perfil.");
        }
        if (roles.contains(Role.ADMIN_GERAL) && roles.size() != 1) {
            throw new IllegalArgumentException(
                    "O perfil administrador geral não pode ser combinado com outros. Crie outra conta se precisar.");
        }
    }

    private void enforceCreateRules(AppUserDetails caller, Set<Role> roles, Long peladaId) {
        if (roles.contains(Role.ADMIN_GERAL) && !caller.isAdminGeral()) {
            throw new IllegalArgumentException(
                    "Somente o administrador geral pode criar contas com perfil administrador geral.");
        }
        if (caller.isAdminGeral()) {
            return;
        }
        if (!caller.hasRole(Role.ADMIN)) {
            throw new AccessDeniedException("Sem permissão para criar usuários.");
        }
        Long ownPelada = caller.getPeladaId();
        if (ownPelada == null) {
            throw new IllegalStateException("Administrador de pelada sem vínculo com pelada.");
        }
        if (peladaId == null || !peladaId.equals(ownPelada)) {
            throw new IllegalArgumentException("Você só pode cadastrar usuários na sua pelada.");
        }
    }

    private Pelada resolvePeladaForRoles(Set<Role> roles, Long peladaId) {
        if (roles.contains(Role.ADMIN_GERAL)) {
            if (peladaId != null) {
                throw new IllegalArgumentException("Administrador geral não é vinculado a uma pelada.");
            }
            return null;
        }
        if (peladaId == null) {
            throw new IllegalArgumentException("Informe a pelada para este conjunto de perfis.");
        }
        return peladaRepository
                .findById(peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
    }

    private UserResponse toResponse(User user) {
        List<Role> sortedRoles = user.getRoles().stream()
                .sorted(Comparator.comparing(Enum::name))
                .toList();
        Long pid = user.getPelada() != null ? user.getPelada().getId() : null;
        String pname = user.getPelada() != null ? user.getPelada().getName() : null;
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .roles(sortedRoles)
                .peladaId(pid)
                .peladaName(pname)
                .build();
    }
}
