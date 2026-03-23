package com.varzeastats.service;

import com.varzeastats.entity.PasswordResetToken;
import com.varzeastats.entity.User;
import com.varzeastats.repository.PasswordResetTokenRepository;
import com.varzeastats.repository.UserRepository;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final int EXPIRACAO_HORAS = 1;

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    @Value("${varzea.password-reset.link-base:http://localhost:5173}")
    private String linkBase;

    @Transactional
    public void solicitarRedefinicaoSenha(String email) {
        userRepository.findByEmail(email.trim()).ifPresent(usuario -> {
            tokenRepository.deleteByUser_Id(usuario.getId());
            String token = UUID.randomUUID().toString().replace("-", "");
            PasswordResetToken entidade = PasswordResetToken.builder()
                    .token(token)
                    .user(usuario)
                    .expiresAt(Instant.now().plusSeconds(EXPIRACAO_HORAS * 3600L))
                    .build();
            tokenRepository.save(entidade);
            String link = linkBase.replaceAll("/$", "") + "/redefinir-senha?token=" + token;
            emailService.enviarEmailRedefinicaoSenha(usuario.getEmail(), link);
        });
    }

    @Transactional
    public void redefinirSenha(String token, String novaSenha) {
        PasswordResetToken t = tokenRepository
                .findByToken(token.trim())
                .orElseThrow(() -> new IllegalArgumentException("Token inválido ou expirado."));
        if (t.isExpired()) {
            tokenRepository.delete(t);
            throw new IllegalArgumentException("Token inválido ou expirado.");
        }
        User usuario = t.getUser();
        usuario.setPassword(passwordEncoder.encode(novaSenha));
        usuario.setMustChangePassword(false);
        userRepository.save(usuario);
        tokenRepository.delete(t);
    }
}
