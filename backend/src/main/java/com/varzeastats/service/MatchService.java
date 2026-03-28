package com.varzeastats.service;

import com.varzeastats.dto.MatchFocusTeamsRequest;
import com.varzeastats.dto.MatchRequest;
import com.varzeastats.dto.MatchResponse;
import com.varzeastats.dto.PlayerResponse;
import com.varzeastats.dto.TeamScoreResponse;
import com.varzeastats.entity.Match;
import com.varzeastats.entity.MatchTeamScore;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.Player;
import com.varzeastats.entity.Team;
import com.varzeastats.repository.EventRepository;
import com.varzeastats.repository.MatchRepository;
import com.varzeastats.repository.MatchTeamScoreRepository;
import com.varzeastats.repository.MediaRepository;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.PlayerRepository;
import com.varzeastats.repository.TeamRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
    private final MediaRepository mediaRepository;
    private final PlayerRepository playerRepository;

    private static final Comparator<Player> PLAYER_ORDER =
            Comparator.comparing(Player::isGoalkeeper).reversed()
                    .thenComparing(p -> p.getTeam().getId())
                    .thenComparing(Player::getId);

    @Transactional(readOnly = true)
    public List<MatchResponse> findAll(long peladaId) {
        List<Match> matches = matchRepository.findAllByPelada_IdOrderByDateDesc(peladaId);
        if (matches.isEmpty()) {
            return List.of();
        }
        List<Long> matchIds = matches.stream().map(Match::getId).toList();
        Map<Long, List<TeamScoreResponse>> scoresByMatchId = new HashMap<>();
        for (Object[] row : eventRepository.sumGoalsByTeamForMatchIds(matchIds)) {
            long mid = ((Number) row[0]).longValue();
            scoresByMatchId
                    .computeIfAbsent(mid, k -> new ArrayList<>())
                    .add(TeamScoreResponse.builder()
                            .teamId(((Number) row[1]).longValue())
                            .teamName((String) row[2])
                            .goals(((Number) row[3]).intValue())
                            .build());
        }
        List<Player> allPlayers = playerRepository.findByMatch_IdInWithTeamAndMatchFetched(matchIds);
        Map<Long, List<Player>> playersByMatchId = new HashMap<>();
        for (Player p : allPlayers) {
            long mid = p.getTeam().getMatch().getId();
            playersByMatchId.computeIfAbsent(mid, k -> new ArrayList<>()).add(p);
        }
        for (List<Player> list : playersByMatchId.values()) {
            list.sort(PLAYER_ORDER);
        }
        return matches.stream()
                .map(m -> toListItemResponse(
                        m,
                        scoresByMatchId.getOrDefault(m.getId(), List.of()),
                        playersByMatchId.getOrDefault(m.getId(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<MatchResponse> findCurrentOpenMatch(long peladaId) {
        return matchRepository
                .findFirstByPelada_IdAndFinishedAtIsNullAndCancelledAtIsNullOrderByIdDesc(peladaId)
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
    public MatchResponse updateFocusTeams(Long matchId, MatchFocusTeamsRequest request, long peladaId) {
        Match match = matchRepository
                .findByIdAndPelada_Id(matchId, peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Partida não encontrada."));
        if (match.getFinishedAt() != null) {
            throw new IllegalArgumentException("Partida encerrada: não é possível alterar o confronto.");
        }
        if (match.getCancelledAt() != null) {
            throw new IllegalArgumentException("Partida cancelada: não é possível alterar o confronto.");
        }
        Long aId = request.getTeamAId();
        Long bId = request.getTeamBId();
        if (aId == null && bId == null) {
            match.setFocusTeamA(null);
            match.setFocusTeamB(null);
            matchRepository.save(match);
            return toResponse(match);
        }
        if (aId == null || bId == null || aId.equals(bId)) {
            throw new IllegalArgumentException("Informe dois times distintos para o confronto, ou ambos nulos para limpar.");
        }
        Team ta = teamRepository.findById(aId).orElseThrow(() -> new IllegalArgumentException("Time não encontrado."));
        Team tb = teamRepository.findById(bId).orElseThrow(() -> new IllegalArgumentException("Time não encontrado."));
        if (!ta.getMatch().getId().equals(matchId) || !tb.getMatch().getId().equals(matchId)) {
            throw new IllegalArgumentException("Os dois times devem pertencer a esta partida.");
        }
        match.setFocusTeamA(ta);
        match.setFocusTeamB(tb);
        matchRepository.save(match);
        return toResponse(match);
    }

    @Transactional
    public MatchResponse finish(Long id, long peladaId) {
        Match match = matchRepository
                .findByIdAndPelada_Id(id, peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Partida não encontrada"));
        if (match.getCancelledAt() != null) {
            throw new IllegalArgumentException("Partida cancelada não pode ser encerrada como encerramento normal.");
        }
        if (match.getFinishedAt() == null) {
            persistScoreSnapshot(match);
            match.setFinishedAt(Instant.now());
            matchRepository.save(match);
        }
        return toResponse(match);
    }

    @Transactional
    public MatchResponse cancel(Long id, long peladaId) {
        Match match = matchRepository
                .findByIdAndPelada_Id(id, peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Partida não encontrada."));
        if (match.getFinishedAt() != null) {
            throw new IllegalArgumentException("Não é possível cancelar uma partida já encerrada.");
        }
        if (match.getCancelledAt() != null) {
            return toResponse(match);
        }
        match.setCancelledAt(Instant.now());
        match.setFocusTeamA(null);
        match.setFocusTeamB(null);
        matchRepository.save(match);
        return toResponse(match);
    }

    /**
     * Remove a partida e todos os dados ligados a ela (lances, votos, jogadores, equipes, placar, mídia). Rankings e
     * estatísticas agregadas deixam de considerar essa partida porque os registros somem da base.
     */
    @Transactional
    public void deletePermanently(Long id, long peladaId) {
        Match match = matchRepository
                .findByIdAndPelada_Id(id, peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Partida não encontrada."));
        Long mid = match.getId();
        eventRepository.deleteByMatch_Id(mid);
        playerRepository.deleteByMatch_Id(mid);
        mediaRepository.deleteByMatch_Id(mid);
        matchTeamScoreRepository.deleteAllForMatch(mid);
        match.setFocusTeamA(null);
        match.setFocusTeamB(null);
        matchRepository.saveAndFlush(match);
        teamRepository.deleteByMatch_Id(mid);
        matchRepository.delete(match);
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
        return toResponse(m, loadPlayersForMatch(m.getId()));
    }

    /** Listagem: placar em lote + elenco completo da partida. */
    private MatchResponse toListItemResponse(Match m, List<TeamScoreResponse> allGoals, List<Player> playersInMatch) {
        return MatchResponse.builder()
                .id(m.getId())
                .peladaId(m.getPelada().getId())
                .date(m.getDate())
                .location(m.getLocation())
                .finishedAt(m.getFinishedAt())
                .cancelledAt(m.getCancelledAt())
                .focusTeamAId(m.getFocusTeamA() != null ? m.getFocusTeamA().getId() : null)
                .focusTeamBId(m.getFocusTeamB() != null ? m.getFocusTeamB().getId() : null)
                .teamScores(allGoals)
                .players(mapPlayers(playersInMatch))
                .build();
    }

    private MatchResponse toResponse(Match m, List<Player> playersForMatch) {
        return MatchResponse.builder()
                .id(m.getId())
                .peladaId(m.getPelada().getId())
                .date(m.getDate())
                .location(m.getLocation())
                .finishedAt(m.getFinishedAt())
                .cancelledAt(m.getCancelledAt())
                .focusTeamAId(m.getFocusTeamA() != null ? m.getFocusTeamA().getId() : null)
                .focusTeamBId(m.getFocusTeamB() != null ? m.getFocusTeamB().getId() : null)
                .teamScores(resolveTeamScores(m))
                .players(mapPlayers(playersForMatch))
                .build();
    }

    private List<Player> loadPlayersForMatch(Long matchId) {
        List<Player> list = playerRepository.findByTeam_Match_IdOrderByGoalkeeperDescTeam_IdAscIdAsc(matchId);
        list.sort(PLAYER_ORDER);
        return list;
    }

    private List<PlayerResponse> mapPlayers(List<Player> players) {
        return players.stream().map(this::toPlayerResponse).toList();
    }

    private PlayerResponse toPlayerResponse(Player p) {
        Long teamId = p.getTeam() != null ? p.getTeam().getId() : null;
        String teamName = p.getTeam() != null ? p.getTeam().getName() : null;
        return PlayerResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .teamId(teamId)
                .teamName(teamName)
                .goalkeeper(p.isGoalkeeper())
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
