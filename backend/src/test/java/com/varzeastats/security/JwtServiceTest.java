package com.varzeastats.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.varzeastats.entity.Role;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService("varzea-stats-test-secret-key-min-256-bits-long-please-use-enough-chars", 3_600_000L);
    }

    @Test
    void generateToken_roundTrip_extractsEmailRolesAndPelada() {
        String token = jwtService.generateToken("user@test.com", Set.of(Role.SCOUT, Role.ADMIN), 42L, false);

        assertThat(jwtService.extractEmail(token)).isEqualTo("user@test.com");
        assertThat(jwtService.extractRoleNames(token)).containsExactlyInAnyOrder("ADMIN", "SCOUT");
        assertThat(jwtService.extractPeladaId(token)).isEqualTo(42L);
        assertThat(jwtService.isTokenValid(token, "user@test.com")).isTrue();
        assertThat(jwtService.isTokenValid(token, "other@test.com")).isFalse();
    }

    @Test
    void generateToken_adminGeral_withoutPeladaClaim() {
        String token = jwtService.generateToken("admin@test.com", Set.of(Role.ADMIN_GERAL), null, false);

        assertThat(jwtService.extractPeladaId(token)).isNull();
        assertThat(jwtService.extractRoleNames(token)).containsExactly("ADMIN_GERAL");
    }
}
