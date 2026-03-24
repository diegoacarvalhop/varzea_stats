package com.varzeastats.service;

import com.varzeastats.dto.ApplyDraftRosterRequest;
import com.varzeastats.dto.ApplyDraftSlotRequest;
import com.varzeastats.dto.ApplyDraftTeamLineRequest;
import com.varzeastats.dto.PlayerDirectoryEntryResponse;
import com.varzeastats.dto.PlayerMatchCreateRequest;
import com.varzeastats.dto.PlayerResponse;
import com.varzeastats.entity.Match;
import com.varzeastats.entity.Match;
import com.varzeastats.entity.Player;
import com.varzeastats.entity.Team;
import com.varzeastats.entity.User;
import com.varzeastats.repository.EventRepository;
import com.varzeastats.repository.PlayerRepository;
import com.varzeastats.repository.TeamRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.repository.UserPeladaMembershipRepository;
import com.varzeastats.repository.VoteRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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
    private final UserRepository userRepository;
    private final UserPeladaMembershipRepository userPeladaMembershipRepository;

    private final MatchAccessHelper matchAccessHelper;

    @Transactional(readOnly = true)
    public List<PlayerDirectoryEntryResponse> findAllDirectory(long peladaId, boolean includePeladaMembers) {
        List<Player> players = playerRepository.findAllForDirectoryInPelada(peladaId);
        List<PlayerDirectoryEntryResponse> out = new ArrayList<>(players.stream()
                .map(this::toDirectoryEntry)
                .toList());
        if (!includePeladaMembers) {
            return out;
        }
        Set<String> namesTaken = new HashSet<>();
        for (Player p : players) {
            namesTaken.add(normalizeDirectoryName(p.getName()));
        }
        for (User u : userRepository.findMembersByPeladaId(peladaId)) {
            String nu = normalizeDirectoryName(u.getName());
            if (namesTaken.add(nu)) {
                out.add(PlayerDirectoryEntryResponse.builder()
                        .playerId(-u.getId())
                        .playerName(u.getName())
                        .teamName("Cadastro na pelada")
                        .matchId(null)
                        .matchDate(null)
                        .matchLocation(null)
                        .goalkeeper(false)
                        .build());
            }
        }
        return out;
    }

    private static String normalizeDirectoryName(String name) {
        if (name == null) {
            return "";
        }
        return name.trim().toLowerCase(Locale.ROOT);
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
        Long ref = request.getDirectoryRef();
        if (ref == null || ref == 0L) {
            throw new IllegalArgumentException("Referência do diretório inválida.");
        }
        Team team = teamRepository
                .findById(request.getTeamId())
                .orElseThrow(() -> new IllegalArgumentException("Equipe não encontrada"));
        if (!team.getMatch().getId().equals(matchId)) {
            throw new IllegalArgumentException("Esta equipe não pertence a esta partida");
        }
        String name = resolveNameFromDirectoryRef(ref, peladaId);
        boolean isGk = Boolean.TRUE.equals(request.getGoalkeeper());
        Player player = Player.builder()
                .name(name)
                .team(team)
                .goalkeeper(isGk)
                .build();
        player = playerRepository.save(player);
        return toResponse(player);
    }

    @Transactional
    public void applyDraftRoster(Long matchId, ApplyDraftRosterRequest request, long peladaId) {
        Match match = matchAccessHelper.requireInPelada(matchId, peladaId);
        if (match.getFinishedAt() != null) {
            throw new IllegalArgumentException("Partida encerrada: não é possível aplicar o sorteio no elenco.");
        }
        List<Team> teams = teamRepository.findByMatch_IdOrderByIdAsc(matchId);
        Map<String, Team> byName = new LinkedHashMap<>();
        for (Team t : teams) {
            byName.putIfAbsent(t.getName(), t);
        }
        for (ApplyDraftTeamLineRequest line : request.getLines()) {
            if (!byName.containsKey(line.getTeamName())) {
                throw new IllegalArgumentException("Equipe não encontrada nesta partida: " + line.getTeamName());
            }
        }
        List<Player> roster = playerRepository.findByTeam_Match_IdOrderByGoalkeeperDescTeam_IdAscIdAsc(matchId);
        for (Player p : roster) {
            removePlayerEntity(p);
        }
        for (ApplyDraftTeamLineRequest line : request.getLines()) {
            Team team = byName.get(line.getTeamName());
            for (ApplyDraftSlotRequest slot : line.getSlots()) {
                PlayerMatchCreateRequest createReq = new PlayerMatchCreateRequest();
                createReq.setTeamId(team.getId());
                createReq.setDirectoryRef(-slot.getUserId());
                createReq.setGoalkeeper(Boolean.TRUE.equals(slot.getGoalkeeper()));
                createForMatch(matchId, createReq, peladaId);
            }
        }
    }

    private String resolveNameFromDirectoryRef(long directoryRef, long peladaId) {
        if (directoryRef > 0) {
            Player source = playerRepository
                    .findById(directoryRef)
                    .orElseThrow(() -> new IllegalArgumentException("Jogador não encontrado no diretório."));
            if (source.getTeam() == null || source.getTeam().getMatch() == null) {
                throw new IllegalArgumentException("Cadastro de jogador inválido.");
            }
            if (!source.getTeam().getMatch().getPelada().getId().equals(peladaId)) {
                throw new IllegalArgumentException("Este jogador não pertence a esta pelada.");
            }
            return source.getName().trim();
        }
        long userId = -directoryRef;
        User user = userRepository
                .findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado no diretório."));
        if (!userPeladaMembershipRepository.existsById_UserIdAndId_PeladaId(userId, peladaId)) {
            throw new IllegalArgumentException("Este usuário não é membro desta pelada.");
        }
        return user.getName().trim();
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
        removePlayerEntity(player);
    }

    private void removePlayerEntity(Player player) {
        Long pid = player.getId();
        eventRepository.clearPlayerAsMain(pid);
        eventRepository.clearPlayerAsTarget(pid);
        voteRepository.deleteByPlayer_Id(pid);
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
