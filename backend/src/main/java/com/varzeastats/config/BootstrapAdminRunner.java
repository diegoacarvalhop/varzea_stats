package com.varzeastats.config;

import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.repository.UserRepository;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class BootstrapAdminRunner implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${varzea.bootstrap.admin.enabled:true}")
    private boolean enabled;

    @Value("${varzea.bootstrap.admin.email:admin@varzea.com}")
    private String email;

    @Value("${varzea.bootstrap.admin.password:admin123}")
    private String password;

    @Value("${varzea.bootstrap.admin.name:Administrador}")
    private String name;

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            return;
        }
        if (userRepository.existsByEmail(email)) {
            return;
        }
        User user = User.builder()
                .name(name)
                .email(email)
                .password(passwordEncoder.encode(password))
                .mustChangePassword(false)
                .accountActive(true)
                .roles(new LinkedHashSet<>(Set.of(Role.ADMIN_GERAL)))
                .build();
        userRepository.save(user);
        log.info("Usuário administrador inicial criado (e-mail: {}). Altere a senha em produção.", email);
    }
}
