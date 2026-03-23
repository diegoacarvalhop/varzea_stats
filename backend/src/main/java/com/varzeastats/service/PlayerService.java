package com.varzeastats.service;

import com.varzeastats.dto.PlayerDirectoryEntryResponse;
import com.varzeastats.dto.PlayerMatchCreateRequest;
import com.varzeastats.dto.PlayerResponse;
import com.varzeastats.entity.Match;
import com.varzeastats.entity.Player;
import com.varzeastats.entity.Team;
import com.varzeastats.repository.EventRepository;
import com.varzeastats.repository.PlayerRepository;
import com.varzeastats.repository.TeamRepository;
import com.varzeastats.repository.VoteRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlayerService {

    private final PlayerRepository playerRepository;
    private final TeamRepository teamRepository;
    private final EventRepository eventRepository;
    private final VoteRepository voteRepository;

    private final MatchAccessHelper matchAccessHelper;

    @Transactional(readOnly = true)
    public List<PlayerDirectoryEntryResponse> findAllDirectory(long peladaId) {
        return playerRepository.findAllForDirectoryInPelada(peladaId).stream()
                .map(this::toDirectoryEntry)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlayerResponse> findByMatch(Long matchId, long peladaId) {
        matchAccessHelper.requireInPelada(matchId, peladaId);
        return playerRepository.findByTeam_Match_IdOrderByGoalkeeperDescTeam_IdAscIdAsc(matchId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public PlayerResponse createForMatch(Long matchId, PlayerMatchCreateRequest request, long peladaId) {
        matchAccessHelper.requireInPelada(matchId, peladaId);
        Team team = teamRepository
                .findById(request.getTeamId())
                .orElseThrow(() -> new IllegalArgumentException("Equipe não encontrada"));
        if (!team.getMatch().getId().equals(matchId)) {
            throw new IllegalArgumentException("Esta equipe não pertence a esta partida");
        }
        boolean isGk = Boolean.TRUE.equals(request.getGoalkeeper());
        Player player = Player.builder()
                .name(request.getName().trim())
                .team(team)
                .goalkeeper(isGk)
                .build();
        player = playerRepository.save(player);
        return toResponse(player);
    }

    @Transactional
    public void deleteForMatch(Long matchId, Long playerId, long peladaId) {
        matchAccessHelper.requireInPelada(matchId, peladaId);
        Player player = playerRepository
                .findById(playerId)
                .orElseThrow(() -> new IllegalArgumentException("Jogador não encontrado"));
        if (player.getTeam() == null || !player.getTeam().getMatch().getId().equals(matchId)) {
            throw new IllegalArgumentException("Este jogador não pertence a esta partida");
        }
        eventRepository.clearPlayerAsMain(playerId);
        eventRepository.clearPlayerAsTarget(playerId);
        voteRepository.deleteByPlayer_Id(playerId);
        playerRepository.delete(player);
    }

    private PlayerResponse toResponse(Player p) {
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

    private PlayerDirectoryEntryResponse toDirectoryEntry(Player p) {
        Team team = p.getTeam();
        Match match = team != null ? team.getMatch() : null;
        return PlayerDirectoryEntryResponse.builder()
                .playerId(p.getId())
                .playerName(p.getName())
                .teamName(team != null ? team.getName() : null)
                .matchId(match != null ? match.getId() : null)
                .matchDate(match != null ? match.getDate() : null)
                .matchLocation(match != null ? match.getLocation() : null)
                .goalkeeper(p.isGoalkeeper())
                .build();
    }
}
