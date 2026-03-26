package com.varzeastats.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.Data;

@Data
public class DraftRunRequest {

    @NotNull
    private LocalDate date;

    /** Usuários presentes marcados como goleiros (devem constar na presença do dia). */
    private List<Long> goalkeeperUserIds = new ArrayList<>();

    /**
     * Opcional (tela da partida): nomes das equipes já criadas na partida.
     * Quando informado, define quantas equipes participarão do sorteio.
     */
    private List<String> teamNames = new ArrayList<>();

    /** Mapa opcional: nome do time -> userId do goleiro escolhido para o time. */
    private Map<String, Long> goalkeeperByTeam = new LinkedHashMap<>();

    /**
     * Opcional (tela da partida): quantidade máxima de jogadores de linha por equipe.
     * Goleiros não contam nesse limite.
     */
    private Integer linePlayersPerTeam;
}
