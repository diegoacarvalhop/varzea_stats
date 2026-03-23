package com.varzeastats.service;

import com.varzeastats.dto.EventInMatchRequest;
import com.varzeastats.dto.EventResponse;
import com.varzeastats.entity.Event;
import com.varzeastats.entity.Match;
import com.varzeastats.entity.Player;
import com.varzeastats.repository.EventRepository;
import com.varzeastats.repository.PlayerRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final PlayerRepository playerRepository;
    private final MatchAccessHelper matchAccessHelper;

    @Transactional(readOnly = true)
    public List<EventResponse> findByMatch(Long matchId, long peladaId) {
        matchAccessHelper.requireInPelada(matchId, peladaId);
        return eventRepository.findByMatch_IdOrderByIdDesc(matchId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public EventResponse createForMatch(Long matchId, EventInMatchRequest request, long peladaId) {
        Match match = matchAccessHelper.requireInPelada(matchId, peladaId);
        Player player = resolvePlayerInMatch(request.getPlayerId(), matchId);
        Player target = resolvePlayerInMatch(request.getTargetId(), matchId);
        Event event = Event.builder()
                .type(request.getType())
                .player(player)
                .target(target)
                .match(match)
                .build();
        event = eventRepository.save(event);
        return toResponse(event);
    }

    private Player resolvePlayerInMatch(Long playerId, Long matchId) {
        if (playerId == null) {
            return null;
        }
        Player p = playerRepository
                .findById(playerId)
                .orElseThrow(() -> new IllegalArgumentException("Jogador não encontrado"));
        assertPlayerInMatch(p, matchId);
        return p;
    }

    private void assertPlayerInMatch(Player p, Long matchId) {
        if (p.getTeam() == null || p.getTeam().getMatch() == null) {
            throw new IllegalArgumentException("Jogador não está vinculado a uma equipe desta partida");
        }
        if (!p.getTeam().getMatch().getId().equals(matchId)) {
            throw new IllegalArgumentException("Jogador não pertence a esta partida");
        }
    }

    private EventResponse toResponse(Event event) {
        return EventResponse.builder()
                .id(event.getId())
                .type(event.getType())
                .playerId(event.getPlayer() != null ? event.getPlayer().getId() : null)
                .targetId(event.getTarget() != null ? event.getTarget().getId() : null)
                .matchId(event.getMatch().getId())
                .build();
    }
}
