package com.varzeastats.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.varzeastats.dto.LoginRequest;
import com.varzeastats.dto.LoginResponse;
import com.varzeastats.dto.PublicRegistrationRequest;
import com.varzeastats.dto.UserResponse;
import com.varzeastats.entity.Role;
import com.varzeastats.security.CustomUserDetailsService;
import com.varzeastats.security.JwtService;
import com.varzeastats.security.PeladaResolver;
import com.varzeastats.service.AuthService;
import com.varzeastats.service.PasswordResetService;
import com.varzeastats.service.UserService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private CustomUserDetailsService customUserDetailsService;

    @MockBean
    private PeladaResolver peladaResolver;

    @MockBean
    private AuthService authService;

    @MockBean
    private PasswordResetService passwordResetService;

    @MockBean
    private UserService userService;

    @Test
    void login_ok_returnsToken() throws Exception {
        LoginResponse body = LoginResponse.builder()
                .token("jwt-here")
                .email("a@a.com")
                .name("Nome")
                .roles(List.of(Role.PLAYER))
                .peladaId(1L)
                .peladaName("Grupo")
                .peladaHasLogo(false)
                .mustChangePassword(false)
                .build();
        when(authService.login(any(LoginRequest.class))).thenReturn(body);

        LoginRequest req = new LoginRequest();
        req.setEmail("a@a.com");
        req.setPassword("secret");

        mockMvc.perform(
                        post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-here"))
                .andExpect(jsonPath("$.email").value("a@a.com"));
    }

    @Test
    void login_invalidEmail_returnsBadRequest() throws Exception {
        LoginRequest req = new LoginRequest();
        req.setEmail("not-an-email");
        req.setPassword("secret");

        mockMvc.perform(
                        post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void cadastro_ok_returns201() throws Exception {
        UserResponse body = UserResponse.builder()
                .id(1L)
                .name("Novo")
                .email("n@n.com")
                .roles(List.of(Role.PLAYER))
                .peladaId(2L)
                .peladaName("Grupo")
                .build();
        when(userService.registerPublic(any(PublicRegistrationRequest.class))).thenReturn(body);

        PublicRegistrationRequest req = new PublicRegistrationRequest();
        req.setName("Novo");
        req.setEmail("n@n.com");
        req.setPeladaId(2L);

        mockMvc.perform(
                        post("/auth/cadastro")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("n@n.com"))
                .andExpect(jsonPath("$.roles[0]").value("PLAYER"));
    }
}
