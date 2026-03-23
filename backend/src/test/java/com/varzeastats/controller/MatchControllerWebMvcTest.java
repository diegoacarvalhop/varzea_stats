package com.varzeastats.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.varzeastats.dto.MatchRequest;
import com.varzeastats.dto.MatchResponse;
import com.varzeastats.security.CustomUserDetailsService;
import com.varzeastats.security.JwtService;
import com.varzeastats.security.PeladaResolver;
import com.varzeastats.service.MatchService;
import com.varzeastats.service.MediaService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = MatchController.class)
@AutoConfigureMockMvc(addFilters = false)
class MatchControllerWebMvcTest {

    private static final long PELADA_ID = 3L;

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
    private MatchService matchService;

    @MockBean
    private MediaService mediaService;

    @Test
    void list_returnsMatches() throws Exception {
        MatchResponse m = MatchResponse.builder()
                .id(1L)
                .peladaId(PELADA_ID)
                .date(Instant.parse("2025-01-01T12:00:00Z"))
                .location("Campo")
                .finishedAt(null)
                .teamScores(List.of())
                .build();
        when(matchService.findAll(PELADA_ID)).thenReturn(List.of(m));

        mockMvc.perform(
                        get("/matches").requestAttr(PeladaResolver.REQUEST_ATTR_PELADA_ID, PELADA_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].location").value("Campo"));
    }

    @Test
    void create_returns201() throws Exception {
        MatchRequest req = new MatchRequest();
        req.setDate(Instant.parse("2025-06-01T18:00:00Z"));
        req.setLocation("Arena");
        MatchResponse created = MatchResponse.builder()
                .id(10L)
                .peladaId(PELADA_ID)
                .date(req.getDate())
                .location("Arena")
                .teamScores(List.of())
                .build();
        when(matchService.create(any(MatchRequest.class), eq(PELADA_ID))).thenReturn(created);

        mockMvc.perform(
                        post("/matches")
                                .requestAttr(PeladaResolver.REQUEST_ATTR_PELADA_ID, PELADA_ID)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10));
    }
}
