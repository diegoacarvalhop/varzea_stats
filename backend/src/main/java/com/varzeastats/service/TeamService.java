package com.varzeastats.service;

import com.varzeastats.dto.TeamCreateRequest;
import com.varzeastats.dto.TeamResponse;
import com.varzeastats.entity.Match;
import com.varzeastats.entity.Team;
import com.varzeastats.repository.TeamRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TeamService {

    private final TeamRepository teamRepository;
    private final MatchAccessHelper matchAccessHelper;

    @Transactional(readOnly = true)
    public List<TeamResponse> findByMatch(Long matchId, long peladaId) {
        matchAccessHelper.requireInPelada(matchId, peladaId);
        return teamRepository.findByMatch_IdOrderByIdAsc(matchId).stream().map(this::toResponse).toList();
    }

    @Transactional
    public TeamResponse createForMatch(Long matchId, TeamCreateRequest request, long peladaId) {
        Match match = matchAccessHelper.requireInPelada(matchId, peladaId);
        Team team = Team.builder().name(request.getName().trim()).match(match).build();
        team = teamRepository.save(team);
        return toResponse(team);
    }

    private TeamResponse toResponse(Team t) {
        return TeamResponse.builder()
                .id(t.getId())
                .name(t.getName())
                .matchId(t.getMatch().getId())
                .build();
    }
}
