package com.varzeastats.service;

import com.varzeastats.dto.MembershipUpdateRequest;
import com.varzeastats.dto.PublicRegistrationRequest;
import com.varzeastats.dto.UserCreateRequest;
import com.varzeastats.dto.UserResponse;
import com.varzeastats.dto.UserUpdateRequest;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.entity.UserPeladaId;
import com.varzeastats.entity.UserPeladaMembership;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.UserPeladaMembershipRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.security.AppUserDetails;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
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
    private final UserPeladaMembershipRepository userPeladaMembershipRepository;
    private final PasswordEncoder passwordEncoder;

    private static String normalizeEmail(String email) {
        if (email == null) {
            throw new IllegalArgumentException("E-mail é obrigatório.");
        }
        String normalized = email.trim().toLowerCase(java.util.Locale.ROOT);
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("E-mail é obrigatório.");
        }
        return normalized;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listForPrincipal(Authentication authentication) {
        AppUserDetails caller = (AppUserDetails) authentication.getPrincipal();
        if (caller.isAdminGeral()) {
            return userRepository.findAll(Sort.by(Sort.Direction.ASC, "email")).stream()
                    .map(this::toResponse)
                    .toList();
        }
        if (caller.hasRole(Role.ADMIN) || caller.hasRole(Role.FINANCEIRO)) {
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
        String email = normalizeEmail(request.getEmail());
        String name = request.getName() == null ? "" : request.getName().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Nome é obrigatório.");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("E-mail já cadastrado");
        }
        LinkedHashSet<Role> roleSet = new LinkedHashSet<>(request.getRoles());
        validateRoleCombination(roleSet);
        AppUserDetails caller = (AppUserDetails) authentication.getPrincipal();
        enforceCreateRules(caller, roleSet, request.getPeladaId());
        Pelada pelada = resolvePeladaForRoles(roleSet, request.getPeladaId());
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new IllegalArgumentException("Informe a senha inicial do usuário.");
        }
        User user = User.builder()
                .name(name)
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .mustChangePassword(false)
                .accountActive(true)
                .roles(new LinkedHashSet<>(roleSet))
                .goalkeeper(roleSet.contains(Role.PLAYER) && Boolean.TRUE.equals(request.getGoalkeeper()))
                .pelada(pelada)
                .build();
        user = userRepository.save(user);
        if (pelada != null) {
            Map<Long, Boolean> billingMap = null;
            if (roleSet.contains(Role.PLAYER)) {
                boolean monthly =
                        request.getBillingMonthly() == null || Boolean.TRUE.equals(request.getBillingMonthly());
                billingMap = Map.of(pelada.getId(), monthly);
            }
            replaceMemberships(user.getId(), List.of(pelada.getId()), billingMap);
        }
        return toResponse(user);
    }

    @Transactional
    public UserResponse registerPublic(PublicRegistrationRequest request) {
        String email = normalizeEmail(request.getEmail());
        if (request.getPassword() == null || request.getPassword().length() < 6) {
            throw new IllegalArgumentException("A senha deve ter pelo menos 6 caracteres.");
        }
        String name = request.getName() == null ? "" : request.getName().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Nome é obrigatório.");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("E-mail já cadastrado");
        }
        Pelada selectedPelada = null;
        LinkedHashSet<Role> roles;
        if (request.getPeladaId() != null) {
            selectedPelada = peladaRepository
                    .findById(request.getPeladaId())
                    .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
            roles = new LinkedHashSet<>(EnumSet.of(Role.PLAYER));
        } else {
            roles = new LinkedHashSet<>(EnumSet.of(Role.ADMIN));
        }
        User user = User.builder()
                .name(name)
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .mustChangePassword(false)
                .accountActive(true)
                .roles(roles)
                .goalkeeper(roles.contains(Role.PLAYER) && Boolean.TRUE.equals(request.getGoalkeeper()))
                .pelada(selectedPelada)
                .build();
        user = userRepository.save(user);
        if (selectedPelada != null) {
            java.util.Map<Long, Boolean> billingMap = new java.util.LinkedHashMap<>();
            billingMap.put(selectedPelada.getId(), Boolean.TRUE.equals(request.getBillingMonthly()));
            replaceMemberships(user.getId(), List.of(selectedPelada.getId()), billingMap);
        }
        return toResponse(user);
    }

    @Transactional
    public UserResponse updateMyMemberships(MembershipUpdateRequest request, Authentication authentication) {
        AppUserDetails caller = (AppUserDetails) authentication.getPrincipal();
        User user = userRepository
                .findByEmailIgnoreCase(caller.getEmail())
                .orElseThrow(() -> new IllegalStateException("Usuário não encontrado."));
        if (!user.getRoles().contains(Role.PLAYER)) {
            throw new AccessDeniedException("Somente contas com perfil de jogador podem alterar peladas aqui.");
        }
        List<Long> ids = request.getPeladaIds().stream().filter(Objects::nonNull).distinct().toList();
        for (Long pid : ids) {
            if (!peladaRepository.existsById(pid)) {
                throw new IllegalArgumentException("Pelada não encontrada: " + pid);
            }
        }
        replaceMemberships(user.getId(), ids, request.getBillingMonthlyByPelada());
        if (ids.isEmpty()) {
            user.setPelada(null);
        } else {
            Pelada first = peladaRepository.findById(ids.get(0)).orElseThrow();
            user.setPelada(first);
        }
        userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public UserResponse updateUser(Long id, UserUpdateRequest request, Authentication authentication) {
        AppUserDetails caller = (AppUserDetails) authentication.getPrincipal();
        User target = userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));
        enforceUpdateRules(caller, target);
        if (request.getName() != null && !request.getName().isBlank()) {
            target.setName(request.getName().trim());
        }
        if (request.getEmail() != null) {
            String email = normalizeEmail(request.getEmail());
            boolean sameEmail = target.getEmail() != null && target.getEmail().equalsIgnoreCase(email);
            if (!sameEmail && userRepository.existsByEmailIgnoreCase(email)) {
                throw new IllegalArgumentException("E-mail já cadastrado");
            }
            target.setEmail(email);
        }
        if (request.getAccountActive() != null) {
            target.setAccountActive(request.getAccountActive());
        }
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            target.setPassword(passwordEncoder.encode(request.getPassword()));
            target.setMustChangePassword(false);
        }
        if (request.getRoles() != null && !request.getRoles().isEmpty()) {
            LinkedHashSet<Role> roleSet = new LinkedHashSet<>(request.getRoles());
            validateRoleCombination(roleSet);
            target.setRoles(roleSet);
        }
        if (request.getGoalkeeper() != null) {
            target.setGoalkeeper(Boolean.TRUE.equals(request.getGoalkeeper()));
        }
        Map<Long, Boolean> billingMap = request.getBillingMonthlyByPelada();
        boolean replacedMemberships = false;
        if (request.getPeladaIds() != null && !request.getPeladaIds().isEmpty()) {
            replaceMemberships(target.getId(), request.getPeladaIds(), billingMap);
            replacedMemberships = true;
            Pelada p = peladaRepository.findById(request.getPeladaIds().get(0)).orElse(null);
            target.setPelada(p);
        } else if (request.getPeladaId() != null) {
            Pelada p = peladaRepository
                    .findById(request.getPeladaId())
                    .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
            if (target.getRoles().contains(Role.ADMIN_GERAL)) {
                target.setPelada(null);
                userPeladaMembershipRepository.deleteById_UserId(target.getId());
            } else {
                target.setPelada(p);
                replaceMemberships(target.getId(), List.of(p.getId()), billingMap);
                replacedMemberships = true;
            }
        }
        if (!replacedMemberships && billingMap != null && !billingMap.isEmpty()) {
            applyBillingUpdatesOnly(caller, target, billingMap);
        }
        if (target.getRoles() == null || !target.getRoles().contains(Role.PLAYER)) {
            target.setGoalkeeper(false);
        }
        target = userRepository.save(target);
        return toResponse(target);
    }

    private void enforceUpdateRules(AppUserDetails caller, User target) {
        if (caller.isAdminGeral()) {
            return;
        }
        if (caller.hasRole(Role.ADMIN) && caller.getPeladaId() != null) {
            if (target.getPelada() != null && target.getPelada().getId().equals(caller.getPeladaId())) {
                return;
            }
            if (userPeladaMembershipRepository.existsById_UserIdAndId_PeladaId(target.getId(), caller.getPeladaId())) {
                return;
            }
        }
        throw new AccessDeniedException("Sem permissão para editar este usuário.");
    }

    private void replaceMemberships(Long userId, List<Long> peladaIds, java.util.Map<Long, Boolean> billingMap) {
        userPeladaMembershipRepository.deleteById_UserId(userId);
        for (Long pid : peladaIds) {
            boolean monthly = true;
            if (billingMap != null && billingMap.containsKey(pid)) {
                monthly = Boolean.TRUE.equals(billingMap.get(pid));
            }
            UserPeladaMembership m = UserPeladaMembership.builder()
                    .id(new UserPeladaId(userId, pid))
                    .billingMonthly(monthly)
                    .build();
            userPeladaMembershipRepository.save(m);
        }
    }

    private void applyBillingUpdatesOnly(AppUserDetails caller, User target, Map<Long, Boolean> billingMap) {
        if (billingMap == null || billingMap.isEmpty()) {
            return;
        }
        Long callerPeladaId = caller.getPeladaId();
        boolean isGeral = caller.isAdminGeral();
        for (Map.Entry<Long, Boolean> e : billingMap.entrySet()) {
            Long pid = e.getKey();
            if (pid == null) {
                continue;
            }
            if (!isGeral) {
                if (callerPeladaId == null || !callerPeladaId.equals(pid)) {
                    throw new AccessDeniedException("Sem permissão para alterar cobrança desta pelada.");
                }
            }
            UserPeladaId id = new UserPeladaId(target.getId(), pid);
            UserPeladaMembership m = userPeladaMembershipRepository
                    .findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Usuário não participa da pelada: " + pid));
            m.setBillingMonthly(Boolean.TRUE.equals(e.getValue()));
            userPeladaMembershipRepository.save(m);
        }
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
        List<Long> pids = userPeladaMembershipRepository.findById_UserId(user.getId()).stream()
                .map(m -> m.getId().getPeladaId())
                .sorted()
                .collect(Collectors.toList());
        Map<Long, Boolean> billingByPelada = new LinkedHashMap<>();
        if (user.getRoles() != null && user.getRoles().contains(Role.PLAYER)) {
            userPeladaMembershipRepository.findById_UserId(user.getId()).forEach(m -> {
                billingByPelada.put(m.getId().getPeladaId(), m.isBillingMonthly());
            });
        }
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .roles(sortedRoles)
                .peladaId(pid)
                .peladaName(pname)
                .accountActive(user.isAccountActive())
                .peladaIds(pids)
                .billingMonthlyByPelada(billingByPelada)
                .goalkeeper(user.isGoalkeeper())
                .build();
    }
}
