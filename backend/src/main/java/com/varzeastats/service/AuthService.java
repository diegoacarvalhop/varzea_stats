package com.varzeastats.service;

import com.varzeastats.dto.ChangePasswordRequest;
import com.varzeastats.dto.LoginRequest;
import com.varzeastats.dto.LoginResponse;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.security.JwtService;
import java.util.Comparator;
import java.util.List;
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
        if (user.getPelada() != null) {
            String fn = user.getPelada().getLogoFileName();
            peladaHasLogo = fn != null && !fn.isBlank();
        }
        List<Role> rolesSorted = user.getRoles().stream()
                .sorted(Comparator.comparing(Enum::name))
                .toList();
        return LoginResponse.builder()
                .token(token)
                .email(user.getEmail())
                .name(user.getName())
                .roles(rolesSorted)
                .peladaId(peladaId)
                .peladaName(peladaName)
                .peladaHasLogo(peladaHasLogo)
                .mustChangePassword(user.isMustChangePassword())
                .build();
    }
}
