package com.varzeastats.service;

import com.varzeastats.dto.MatchRequest;
import com.varzeastats.dto.MatchResponse;
import com.varzeastats.dto.TeamScoreResponse;
import com.varzeastats.entity.Match;
import com.varzeastats.entity.MatchTeamScore;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.Team;
import com.varzeastats.repository.EventRepository;
import com.varzeastats.repository.MatchRepository;
import com.varzeastats.repository.MatchTeamScoreRepository;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.TeamRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MatchService {

    private final MatchRepository matchRepository;
    private final EventRepository eventRepository;
    private final MatchTeamScoreRepository matchTeamScoreRepository;
    private final TeamRepository teamRepository;
    private final PeladaRepository peladaRepository;

    @Transactional(readOnly = true)
    public List<MatchResponse> findAll(long peladaId) {
        return matchRepository.findAllByPelada_IdOrderByDateDesc(peladaId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<MatchResponse> findCurrentOpenMatch(long peladaId) {
        return matchRepository
                .findFirstByPelada_IdAndFinishedAtIsNullOrderByIdDesc(peladaId)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public MatchResponse findById(Long id, long peladaId) {
        Match match = matchRepository
                .findByIdAndPelada_Id(id, peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Partida não encontrada"));
        return toResponse(match);
    }

    @Transactional
    public MatchResponse create(MatchRequest request, long peladaId) {
        Pelada pelada = peladaRepository.getReferenceById(peladaId);
        Match match = Match.builder()
                .date(request.getDate())
                .location(request.getLocation())
                .pelada(pelada)
                .build();
        match = matchRepository.save(match);
        return toResponse(match);
    }

    @Transactional
    public MatchResponse finish(Long id, long peladaId) {
        Match match = matchRepository
                .findByIdAndPelada_Id(id, peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Partida não encontrada"));
        if (match.getFinishedAt() == null) {
            persistScoreSnapshot(match);
            match.setFinishedAt(Instant.now());
            matchRepository.save(match);
        }
        return toResponse(match);
    }

    private void persistScoreSnapshot(Match match) {
        Long matchId = match.getId();
        matchTeamScoreRepository.deleteAllForMatch(matchId);
        for (Object[] row : eventRepository.sumGoalsByTeamForMatch(matchId)) {
            Long teamId = ((Number) row[0]).longValue();
            int goals = ((Number) row[2]).intValue();
            Team team = teamRepository.getReferenceById(teamId);
            matchTeamScoreRepository.save(MatchTeamScore.builder()
                    .match(match)
                    .team(team)
                    .goals(goals)
                    .build());
        }
    }

    private MatchResponse toResponse(Match m) {
        return MatchResponse.builder()
                .id(m.getId())
                .peladaId(m.getPelada().getId())
                .date(m.getDate())
                .location(m.getLocation())
                .finishedAt(m.getFinishedAt())
                .teamScores(resolveTeamScores(m))
                .build();
    }

    private List<TeamScoreResponse> resolveTeamScores(Match m) {
        Long matchId = m.getId();
        if (m.getFinishedAt() != null) {
            List<MatchTeamScore> snap = matchTeamScoreRepository.findByMatch_IdOrderByTeam_IdAsc(matchId);
            if (!snap.isEmpty()) {
                return snap.stream()
                        .map(s -> TeamScoreResponse.builder()
                                .teamId(s.getTeam().getId())
                                .teamName(s.getTeam().getName())
                                .goals(s.getGoals())
                                .build())
                        .toList();
            }
        }
        return goalsFromEvents(matchId);
    }

    private List<TeamScoreResponse> goalsFromEvents(Long matchId) {
        return eventRepository.sumGoalsByTeamForMatch(matchId).stream()
                .map(row -> TeamScoreResponse.builder()
                        .teamId(((Number) row[0]).longValue())
                        .teamName((String) row[1])
                        .goals(((Number) row[2]).intValue())
                        .build())
                .toList();
    }
}
