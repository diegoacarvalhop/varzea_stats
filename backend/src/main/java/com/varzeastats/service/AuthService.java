package com.varzeastats.service;

import com.varzeastats.dto.ChangePasswordRequest;
import com.varzeastats.dto.LoginRequest;
import com.varzeastats.dto.LoginResponse;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.repository.UserPeladaMembershipRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.security.JwtService;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final UserPeladaMembershipRepository userPeladaMembershipRepository;
    private final FinanceService financeService;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
        User user = userRepository
                .findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Credenciais inválidas"));
        Long peladaId = user.getPelada() != null ? user.getPelada().getId() : null;
        String token = jwtService.generateToken(
                user.getEmail(), user.getRoles(), peladaId, user.isMustChangePassword());
        return toLoginResponse(user, token);
    }

    @Transactional(readOnly = true)
    public LoginResponse profile(String email, String bearerToken) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));
        String token = bearerToken != null && bearerToken.startsWith("Bearer ") ? bearerToken.substring(7) : bearerToken;
        return toLoginResponse(user, token != null ? token : "");
    }

    @Transactional(readOnly = true)
    public LoginResponse reissueToken(String email) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));
        Long peladaId = user.getPelada() != null ? user.getPelada().getId() : null;
        String token = jwtService.generateToken(
                user.getEmail(), user.getRoles(), peladaId, user.isMustChangePassword());
        return toLoginResponse(user, token);
    }

    @Transactional
    public LoginResponse changePassword(String email, ChangePasswordRequest request) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));
        if (!passwordEncoder.matches(request.getSenhaAtual(), user.getPassword())) {
            throw new IllegalArgumentException("Senha atual incorreta.");
        }
        user.setPassword(passwordEncoder.encode(request.getNovaSenha()));
        user.setMustChangePassword(false);
        userRepository.save(user);
        Long peladaId = user.getPelada() != null ? user.getPelada().getId() : null;
        String token = jwtService.generateToken(user.getEmail(), user.getRoles(), peladaId, false);
        return toLoginResponse(user, token);
    }

    private LoginResponse toLoginResponse(User user, String token) {
        String peladaName = user.getPelada() != null ? user.getPelada().getName() : null;
        Long peladaId = user.getPelada() != null ? user.getPelada().getId() : null;
        Boolean peladaHasLogo = null;
        Integer peladaMonthlyDueDay = null;
        if (user.getPelada() != null) {
            String fn = user.getPelada().getLogoFileName();
            peladaHasLogo = fn != null && !fn.isBlank();
            Integer d = user.getPelada().getMonthlyDueDay();
            peladaMonthlyDueDay = d != null ? d : 15;
        }
        List<Role> rolesSorted = user.getRoles().stream()
                .sorted(Comparator.comparing(Enum::name))
                .toList();
        List<Long> membershipIds = userPeladaMembershipRepository.findById_UserId(user.getId()).stream()
                .map(m -> m.getId().getPeladaId())
                .sorted()
                .collect(Collectors.toList());
        Map<Long, Boolean> billingMonthlyByPelada = new LinkedHashMap<>();
        if (user.getRoles() != null && user.getRoles().contains(Role.PLAYER)) {
            userPeladaMembershipRepository.findById_UserId(user.getId()).forEach(m -> {
                billingMonthlyByPelada.put(m.getId().getPeladaId(), m.isBillingMonthly());
            });
        }
        List<Long> delinquent = financeService.monthlyDelinquentPeladaIdsForUser(
                user.getId(), membershipIds, LocalDate.now());
        return LoginResponse.builder()
                .token(token)
                .email(user.getEmail())
                .name(user.getName())
                .roles(rolesSorted)
                .peladaId(peladaId)
                .peladaName(peladaName)
                .peladaHasLogo(peladaHasLogo)
                .peladaMonthlyDueDay(peladaMonthlyDueDay)
                .mustChangePassword(user.isMustChangePassword())
                .membershipPeladaIds(membershipIds)
                .monthlyDelinquentPeladaIds(delinquent)
                .billingMonthlyByPelada(billingMonthlyByPelada)
                .accountActive(user.isAccountActive())
                .build();
    }
}
