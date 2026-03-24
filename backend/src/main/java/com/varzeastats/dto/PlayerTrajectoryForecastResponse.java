package com.varzeastats.dto;

import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlayerTrajectoryForecastResponse {

    /** Média simples de gols por partida (só jogos com lance registrado). */
    private double averageGoalsPerMatch;

    /** Estimativa arredondada para a “próxima” partida, média móvel das últimas até 5 jogos. */
    private Integer estimatedGoalsNextMatch;

    private double averageAssistsPerMatch;
    private Integer estimatedAssistsNextMatch;

    /** Médias por evento para todos os tipos contabilizados na previsão. */
    private Map<String, Double> averageByEventPerMatch;

    /** Estimativas por evento para a próxima partida (média móvel recente). */
    private Map<String, Integer> estimatedByEventNextMatch;

    /** Ex.: "em alta", "em baixa", "estável" comparando primeira vs segunda metade da série. */
    private String goalsTrendLabel;

    private String narrative;

    /** Aviso sobre limitações do modelo. */
    private String methodologyNote;
}
