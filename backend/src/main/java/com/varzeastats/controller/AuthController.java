package com.varzeastats.controller;

import com.varzeastats.dto.ChangePasswordRequest;
import com.varzeastats.dto.EsqueciSenhaRequest;
import com.varzeastats.dto.LoginRequest;
import com.varzeastats.dto.LoginResponse;
import com.varzeastats.dto.PublicRegistrationRequest;
import com.varzeastats.dto.UserResponse;
import com.varzeastats.dto.RedefinirSenhaRequest;
import com.varzeastats.security.AppUserDetails;
import com.varzeastats.service.AuthService;
import com.varzeastats.service.PasswordResetService;
import com.varzeastats.service.UserService;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;
    private final UserService userService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/cadastro")
    public ResponseEntity<UserResponse> cadastro(@Valid @RequestBody PublicRegistrationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.registerPublic(request));
    }

    @PostMapping("/change-password")
    public ResponseEntity<LoginResponse> changePassword(
            @Valid @RequestBody ChangePasswordRequest request, Authentication authentication) {
        AppUserDetails details = (AppUserDetails) authentication.getPrincipal();
        return ResponseEntity.ok(authService.changePassword(details.getEmail(), request));
    }

    @PostMapping("/esqueci-senha")
    public ResponseEntity<Map<String, String>> esqueciSenha(@Valid @RequestBody EsqueciSenhaRequest request) {
        passwordResetService.solicitarRedefinicaoSenha(request.getEmail());
        return ResponseEntity.ok(
                Map.of("mensagem", "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha."));
    }

    @PostMapping("/redefinir-senha")
    public ResponseEntity<Map<String, String>> redefinirSenha(@Valid @RequestBody RedefinirSenhaRequest request) {
        passwordResetService.redefinirSenha(request.getToken(), request.getNovaSenha());
        return ResponseEntity.ok(Map.of("mensagem", "Senha alterada com sucesso. Faça login com a nova senha."));
    }
}
