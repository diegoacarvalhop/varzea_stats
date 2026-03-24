package com.varzeastats.service;

import com.varzeastats.dto.VoteRequest;
import com.varzeastats.entity.Player;
import com.varzeastats.entity.User;
import com.varzeastats.entity.Vote;
import com.varzeastats.repository.PlayerRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.repository.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VoteService {

    private final VoteRepository voteRepository;
    private final PlayerRepository playerRepository;
    private final UserRepository userRepository;

    @Transactional
    public Long register(VoteRequest request, long peladaId, long voterUserId) {
        if (voteRepository.existsByVoter_IdAndPlayer_IdAndType(voterUserId, request.getPlayerId(), request.getType())) {
            throw new IllegalArgumentException("Você já registrou este voto para este jogador.");
        }
        Player player = playerRepository
                .findById(request.getPlayerId())
                .orElseThrow(() -> new IllegalArgumentException("Jogador não encontrado"));
        if (player.getTeam() == null
                || player.getTeam().getMatch() == null
                || player.getTeam().getMatch().getPelada() == null
                || !player.getTeam().getMatch().getPelada().getId().equals(peladaId)) {
            throw new IllegalArgumentException("Jogador não pertence a esta pelada.");
        }
        User voter = userRepository.getReferenceById(voterUserId);
        Vote vote = Vote.builder().player(player).type(request.getType()).voter(voter).build();
        return voteRepository.save(vote).getId();
    }
}
