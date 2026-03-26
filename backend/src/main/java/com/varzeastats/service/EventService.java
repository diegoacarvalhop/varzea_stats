package com.varzeastats.service;

import com.varzeastats.dto.EventInMatchRequest;
import com.varzeastats.dto.EventResponse;
import com.varzeastats.entity.Event;
import com.varzeastats.entity.EventType;
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
        validateEventSemantics(request.getType(), player, target);
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

    private static void validateEventSemantics(EventType type, Player player, Player target) {
        switch (type) {
            case ASSIST, YELLOW_CARD, RED_CARD, BLUE_CARD -> {
                if (player == null) {
                    throw new IllegalArgumentException("Selecione o jogador principal para este tipo de lance.");
                }
                if (target != null) {
                    throw new IllegalArgumentException("Este tipo de lance não utiliza jogador alvo.");
                }
            }
            case GOAL -> {
                if (player == null) {
                    throw new IllegalArgumentException("Selecione o jogador principal para este tipo de lance.");
                }
                if (target == null) {
                    throw new IllegalArgumentException("Selecione o goleiro/alvo para este lance.");
                }
                if (!target.isGoalkeeper()) {
                    throw new IllegalArgumentException("O alvo do gol precisa ser o goleiro adversário.");
                }
                if (player.getTeam() != null && target.getTeam() != null
                        && player.getTeam().getId().equals(target.getTeam().getId())) {
                    throw new IllegalArgumentException("Selecione o goleiro adversário do gol.");
                }
                if (player.getId().equals(target.getId())) {
                    throw new IllegalArgumentException("Jogador principal e goleiro/alvo não podem ser a mesma pessoa.");
                }
            }
            case OWN_GOAL -> {
                if (player == null) {
                    throw new IllegalArgumentException("Selecione o jogador principal para este tipo de lance.");
                }
                if (target == null) {
                    throw new IllegalArgumentException("Selecione o goleiro/alvo do gol contra.");
                }
                if (!target.isGoalkeeper()) {
                    throw new IllegalArgumentException("O alvo do gol contra precisa ser o goleiro da própria equipe.");
                }
                if (player.getTeam() != null && target.getTeam() != null
                        && !player.getTeam().getId().equals(target.getTeam().getId())) {
                    throw new IllegalArgumentException("Selecione o goleiro da própria equipe para o gol contra.");
                }
                if (player.getId().equals(target.getId())) {
                    throw new IllegalArgumentException("Jogador principal e goleiro/alvo do gol contra não podem ser a mesma pessoa.");
                }
            }
            case FOUL -> {
                if (player == null) {
                    throw new IllegalArgumentException("Selecione o infrator da falta.");
                }
                if (target == null) {
                    throw new IllegalArgumentException("Selecione quem sofreu a falta.");
                }
                if (player.getId().equals(target.getId())) {
                    throw new IllegalArgumentException("Infrator e sofredor da falta não podem ser a mesma pessoa.");
                }
            }
            case PENALTY_PLAY -> {
                if (player == null) {
                    throw new IllegalArgumentException("Selecione o cobrador do pênalti em jogo.");
                }
                if (target == null) {
                    throw new IllegalArgumentException("Selecione o goleiro/alvo do pênalti em jogo.");
                }
                if (!target.isGoalkeeper()) {
                    throw new IllegalArgumentException("O alvo do pênalti em jogo precisa ser o goleiro adversário.");
                }
                if (player.getTeam() != null && target.getTeam() != null
                        && player.getTeam().getId().equals(target.getTeam().getId())) {
                    throw new IllegalArgumentException("Selecione o goleiro adversário do pênalti em jogo.");
                }
                if (player.getId().equals(target.getId())) {
                    throw new IllegalArgumentException("Cobrador e alvo do pênalti em jogo não podem ser a mesma pessoa.");
                }
            }
            case PENALTY -> {
                if (player == null) {
                    throw new IllegalArgumentException("Selecione o cobrador do pênalti.");
                }
                if (target == null) {
                    throw new IllegalArgumentException("Selecione o goleiro/alvo do pênalti.");
                }
                if (player.getId().equals(target.getId())) {
                    throw new IllegalArgumentException("Cobrador e alvo do pênalti não podem ser a mesma pessoa.");
                }
            }
            case SUBSTITUTION -> {
                if (player == null || target == null) {
                    throw new IllegalArgumentException("Substituição exige jogador que sai e jogador que entra.");
                }
            }
            case OTHER -> {
                // combinações livres (ex.: observação sem jogador vinculado)
            }
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
