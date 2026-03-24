package com.varzeastats.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.varzeastats.dto.MatchRequest;
import com.varzeastats.dto.MatchResponse;
import com.varzeastats.entity.Match;
import com.varzeastats.entity.Pelada;
import com.varzeastats.repository.EventRepository;
import com.varzeastats.repository.MatchRepository;
import com.varzeastats.repository.MatchTeamScoreRepository;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.TeamRepository;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MatchServiceTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private EventRepository eventRepository;

    @Mock
    private MatchTeamScoreRepository matchTeamScoreRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private PeladaRepository peladaRepository;

    @InjectMocks
    private MatchService matchService;

    private final Pelada peladaRef = Pelada.builder().id(5L).name("P").build();

    @Test
    void create_persistsMatchAndReturnsResponse() {
        Instant whenInstant = Instant.parse("2025-03-21T15:00:00Z");
        MatchRequest req = new MatchRequest();
        req.setDate(whenInstant);
        req.setLocation("Campo X");

        when(peladaRepository.getReferenceById(5L)).thenReturn(peladaRef);
        when(eventRepository.sumGoalsByTeamForMatch(anyLong())).thenReturn(Collections.emptyList());
        when(matchRepository.save(any(Match.class)))
                .thenAnswer(invocation -> {
                    Match m = invocation.getArgument(0);
                    m.setId(100L);
                    return m;
                });

        MatchResponse res = matchService.create(req, 5L);

        assertThat(res.getId()).isEqualTo(100L);
        assertThat(res.getPeladaId()).isEqualTo(5L);
        assertThat(res.getLocation()).isEqualTo("Campo X");
        assertThat(res.getDate()).isEqualTo(whenInstant);
        assertThat(res.getTeamScores()).isEmpty();
        verify(matchRepository).save(any(Match.class));
    }

    @Test
    void findAll_delegatesToRepository() {
        Match m = Match.builder()
                .id(1L)
                .date(Instant.now())
                .location("L")
                .pelada(peladaRef)
                .build();
        when(matchRepository.findAllByPelada_IdOrderByDateDesc(5L)).thenReturn(List.of(m));

        List<MatchResponse> list = matchService.findAll(5L);

        assertThat(list).hasSize(1);
        assertThat(list.get(0).getId()).isEqualTo(1L);
    }
}
