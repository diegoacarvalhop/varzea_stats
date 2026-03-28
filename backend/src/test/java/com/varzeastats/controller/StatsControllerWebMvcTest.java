package com.varzeastats.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.varzeastats.dto.LanceRankingsResponse;
import com.varzeastats.dto.PlayerStatsResponse;
import com.varzeastats.security.CustomUserDetailsService;
import com.varzeastats.security.JwtService;
import com.varzeastats.security.PeladaResolver;
import com.varzeastats.service.StatsService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = StatsController.class)
@AutoConfigureMockMvc(addFilters = false)
class StatsControllerWebMvcTest {

    private static final long PELADA_ID = 8L;

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private CustomUserDetailsService customUserDetailsService;

    @MockBean
    private PeladaResolver peladaResolver;

    @MockBean
    private StatsService statsService;

    @Test
    void playerStats_ok() throws Exception {
        PlayerStatsResponse stats = PlayerStatsResponse.builder()
                .playerId(1L)
                .playerName("João")
                .teamName("Time A")
                .goalkeeper(false)
                .eventsByType(Map.of("GOAL", 3L))
                .build();
        when(statsService.playerStats(1L, PELADA_ID)).thenReturn(stats);

        mockMvc.perform(
                        get("/stats/player/1")
                                .requestAttr(PeladaResolver.REQUEST_ATTR_PELADA_ID, PELADA_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playerName").value("João"))
                .andExpect(jsonPath("$.eventsByType.GOAL").value(3));
    }

    @Test
    void lanceRankings_ok() throws Exception {
        LanceRankingsResponse body = LanceRankingsResponse.builder().blocks(List.of()).build();
        when(statsService.lanceRankings(20, PELADA_ID)).thenReturn(body);

        mockMvc.perform(
                        get("/stats/ranking/lances")
                                .requestAttr(PeladaResolver.REQUEST_ATTR_PELADA_ID, PELADA_ID))
                .andExpect(status().isOk());
    }
}
