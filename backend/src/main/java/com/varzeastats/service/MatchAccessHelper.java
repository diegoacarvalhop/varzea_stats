package com.varzeastats.service;

import com.varzeastats.entity.Match;
import com.varzeastats.repository.MatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MatchAccessHelper {

    private final MatchRepository matchRepository;

    public Match requireInPelada(Long matchId, long peladaId) {
        return matchRepository
                .findByIdAndPelada_Id(matchId, peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Partida não encontrada"));
    }
}
