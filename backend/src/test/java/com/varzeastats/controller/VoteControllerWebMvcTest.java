package com.varzeastats.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.varzeastats.dto.VoteRequest;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.entity.VoteType;
import com.varzeastats.security.AppUserDetails;
import com.varzeastats.security.CustomUserDetailsService;
import com.varzeastats.security.JwtService;
import com.varzeastats.security.PeladaResolver;
import com.varzeastats.service.VoteService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import java.util.Set;

@WebMvcTest(controllers = VoteController.class)
@AutoConfigureMockMvc(addFilters = false)
class VoteControllerWebMvcTest {

    private static final long PELADA_ID = 2L;
    private static final long VOTER_USER_ID = 99L;

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
    private VoteService voteService;

    @Test
    void vote_returnsCreatedWithId() throws Exception {
        when(voteService.register(any(VoteRequest.class), eq(PELADA_ID), eq(VOTER_USER_ID)))
                .thenReturn(55L);

        VoteRequest req = new VoteRequest();
        req.setPlayerId(9L);
        req.setType(VoteType.BOLA_CHEIA);

        User u = User.builder()
                .id(VOTER_USER_ID)
                .name("V")
                .email("v@v.com")
                .password("x")
                .roles(Set.of(Role.PLAYER))
                .accountActive(true)
                .build();
        AppUserDetails principal = new AppUserDetails(u);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());

        mockMvc.perform(
                        post("/votes")
                                .principal(auth)
                                .requestAttr(PeladaResolver.REQUEST_ATTR_PELADA_ID, PELADA_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(55));
    }
}
