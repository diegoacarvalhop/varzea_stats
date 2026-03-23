package com.varzeastats.service;

import com.varzeastats.dto.EventTypeRankingBlockResponse;
import com.varzeastats.dto.LanceRankingsResponse;
import com.varzeastats.dto.PlayerEventCountResponse;
import com.varzeastats.dto.PlayerStatsResponse;
import com.varzeastats.dto.PlayerTrajectoryForecastResponse;
import com.varzeastats.dto.PlayerTrajectoryResponse;
import com.varzeastats.dto.TrajectoryCumulativePointResponse;
import com.varzeastats.dto.TrajectoryMatchSliceResponse;
import com.varzeastats.dto.VoteRankingEntryResponse;
import com.varzeastats.dto.VoteRankingResponse;
import com.varzeastats.entity.EventType;
import com.varzeastats.entity.Player;
import com.varzeastats.entity.VoteType;
import com.varzeastats.repository.EventRepository;
import com.varzeastats.repository.PlayerRepository;
import com.varzeastats.repository.VoteRepository;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StatsService {

    private static final String TRAJECTORY_METHODOLOGY =
            "Agrupamos lances em que o jogador principal tem o mesmo nome em partidas diferentes. "
                    + "Pessoas homônimas aparecem juntas. A previsão usa média móvel das últimas partidas com lance registrado — "
                    + "é uma estimativa informal para a pelada, não um modelo estatístico confiável.";

    private static final List<EventType> LANCE_RANKING_ORDER = List.of(
            EventType.GOAL,
            EventType.ASSIST,
            EventType.YELLOW_CARD,
            EventType.RED_CARD,
            EventType.BLUE_CARD,
            EventType.FOUL,
            EventType.SUBSTITUTION,
            EventType.OTHER);

    private final PlayerRepository playerRepository;
    private final EventRepository eventRepository;
    private final VoteRepository voteRepository;

    @Transactional(readOnly = true)
    public PlayerStatsResponse playerStats(Long playerId, long peladaId) {
        Player player = playerRepository
                .findById(playerId)
                .orElseThrow(() -> new IllegalArgumentException("Jogador não encontrado"));
        assertPlayerInPelada(player, peladaId);
        Map<String, Long> byType = new LinkedHashMap<>();
        for (EventType t : EventType.values()) {
            byType.put(t.name(), eventRepository.countByPlayerAndType(player, t));
        }
        long cheia = voteRepository.countByPlayerAndType(player, VoteType.BOLA_CHEIA);
        long murcha = voteRepository.countByPlayerAndType(player, VoteType.BOLA_MURCHA);
        Long teamId = player.getTeam() != null ? player.getTeam().getId() : null;
        String teamName = player.getTeam() != null ? player.getTeam().getName() : null;
        return PlayerStatsResponse.builder()
                .playerId(player.getId())
                .playerName(player.getName())
                .teamId(teamId)
                .teamName(teamName)
                .goalkeeper(player.isGoalkeeper())
                .eventsByType(byType)
                .bolaCheiaVotes(cheia)
                .bolaMurchaVotes(murcha)
                .build();
    }

    @Transactional(readOnly = true)
    public PlayerTrajectoryResponse playerTrajectory(Long playerId, long peladaId) {
        Player anchor = playerRepository
                .findById(playerId)
                .orElseThrow(() -> new IllegalArgumentException("Jogador não encontrado"));
        assertPlayerInPelada(anchor, peladaId);
        String nameKey = anchor.getName().trim();
        List<Object[]> rows = eventRepository.aggregateMainPlayerEventsByMatchForName(nameKey, peladaId);
        List<TrajectoryMatchSliceResponse> slices = new ArrayList<>();
        for (Object[] row : rows) {
            Long mid = ((Number) row[0]).longValue();
            Instant when = instantFromNativeQuery(row[1]);
            String loc = row[2] != null ? row[2].toString() : "";
            long g = ((Number) row[3]).longValue();
            long a = ((Number) row[4]).longValue();
            long y = ((Number) row[5]).longValue();
            long r = ((Number) row[6]).longValue();
            long b = ((Number) row[7]).longValue();
            long f = ((Number) row[8]).longValue();
            slices.add(TrajectoryMatchSliceResponse.builder()
                    .matchId(mid)
                    .matchDate(when)
                    .matchLocation(loc)
                    .goals(g)
                    .assists(a)
                    .yellowCards(y)
                    .redCards(r)
                    .blueCards(b)
                    .fouls(f)
                    .build());
        }
        long cumG = 0;
        long cumA = 0;
        List<TrajectoryCumulativePointResponse> cumulative = new ArrayList<>();
        for (TrajectoryMatchSliceResponse s : slices) {
            cumG += s.getGoals();
            cumA += s.getAssists();
            cumulative.add(TrajectoryCumulativePointResponse.builder()
                    .matchId(s.getMatchId())
                    .matchDate(s.getMatchDate())
                    .cumulativeGoals(cumG)
                    .cumulativeAssists(cumA)
                    .build());
        }
        return PlayerTrajectoryResponse.builder()
                .groupedByPlayerName(nameKey)
                .matchesWithEvents(slices.size())
                .byMatch(slices)
                .cumulativeByMatch(cumulative)
                .forecast(buildForecast(slices))
                .build();
    }

    private PlayerTrajectoryForecastResponse buildForecast(List<TrajectoryMatchSliceResponse> slices) {
        if (slices.isEmpty()) {
            return PlayerTrajectoryForecastResponse.builder()
                    .methodologyNote(TRAJECTORY_METHODOLOGY)
                    .goalsTrendLabel("estável")
                    .narrative("Ainda não há partidas com lances registrados para jogadores com este nome.")
                    .build();
        }
        int n = slices.size();
        double avgGoals = slices.stream().mapToLong(TrajectoryMatchSliceResponse::getGoals).average().orElse(0);
        double avgAssists = slices.stream().mapToLong(TrajectoryMatchSliceResponse::getAssists).average().orElse(0);
        int window = Math.min(5, n);
        List<TrajectoryMatchSliceResponse> tail = slices.subList(n - window, n);
        double recentGoals = tail.stream().mapToLong(TrajectoryMatchSliceResponse::getGoals).average().orElse(avgGoals);
        double recentAssists = tail.stream().mapToLong(TrajectoryMatchSliceResponse::getAssists).average().orElse(avgAssists);
        List<Long> goalsSeries = slices.stream().map(TrajectoryMatchSliceResponse::getGoals).toList();
        String trendCode = trendGoals(goalsSeries);
        String trendPt =
                switch (trendCode) {
                    case "UP" -> "em alta";
                    case "DOWN" -> "em baixa";
                    default -> "estável";
                };
        int estG = (int) Math.round(recentGoals);
        int estA = (int) Math.round(recentAssists);
        String narrative = String.format(
                "Foram consideradas %d partida(s) em que há lance com este nome. "
                        + "Média de %.1f gol(s) por partida (%.1f nas últimas %d). "
                        + "Tendência de gols: %s. "
                        + "Para a próxima pelada, uma referência informal seria ~%d gol(s) e ~%d assistência(s) "
                        + "se o ritmo recente se repetir.",
                n, avgGoals, recentGoals, window, trendPt, estG, estA);
        return PlayerTrajectoryForecastResponse.builder()
                .averageGoalsPerMatch(round1(avgGoals))
                .estimatedGoalsNextMatch(estG)
                .averageAssistsPerMatch(round1(avgAssists))
                .estimatedAssistsNextMatch(estA)
                .goalsTrendLabel(trendPt)
                .narrative(narrative)
                .methodologyNote(TRAJECTORY_METHODOLOGY)
                .build();
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    /**
     * Hibernate/driver PostgreSQL podem devolver Timestamp, Instant, LocalDateTime, OffsetDateTime ou ZonedDateTime em
     * {@code nativeQuery}.
     */
    private static Instant instantFromNativeQuery(Object v) {
        if (v == null) {
            return Instant.EPOCH;
        }
        if (v instanceof Instant i) {
            return i;
        }
        if (v instanceof java.sql.Timestamp ts) {
            return ts.toInstant();
        }
        if (v instanceof java.util.Date d) {
            return d.toInstant();
        }
        if (v instanceof OffsetDateTime odt) {
            return odt.toInstant();
        }
        if (v instanceof ZonedDateTime zdt) {
            return zdt.toInstant();
        }
        if (v instanceof LocalDateTime ldt) {
            return ldt.atZone(ZoneId.systemDefault()).toInstant();
        }
        if (v instanceof java.sql.Date sd) {
            return sd.toLocalDate().atStartOfDay(ZoneId.systemDefault()).toInstant();
        }
        throw new IllegalStateException(
                "Tipo de data não suportado na agregação por partida: " + v.getClass().getName());
    }

    /** Compara média da primeira metade da série com a segunda (gols por partida). */
    private static String trendGoals(List<Long> goalsPerMatch) {
        int n = goalsPerMatch.size();
        if (n < 2) {
            return "STABLE";
        }
        int mid = n / 2;
        double first = goalsPerMatch.subList(0, mid).stream().mapToLong(Long::longValue).average().orElse(0);
        double second = goalsPerMatch.subList(mid, n).stream().mapToLong(Long::longValue).average().orElse(0);
        if (second > first * 1.2 && second - first >= 0.25) {
            return "UP";
        }
        if (second < first * 0.8 && first - second >= 0.25) {
            return "DOWN";
        }
        return "STABLE";
    }

    private void assertPlayerInPelada(Player player, long peladaId) {
        if (player.getTeam() == null
                || player.getTeam().getMatch() == null
                || player.getTeam().getMatch().getPelada() == null
                || !player.getTeam().getMatch().getPelada().getId().equals(peladaId)) {
            throw new IllegalArgumentException("Jogador não encontrado nesta pelada.");
        }
    }

    @Transactional(readOnly = true)
    public VoteRankingResponse voteRanking(int limit, long peladaId) {
        int cap = Math.min(Math.max(limit, 1), 50);
        PageRequest page = PageRequest.of(0, cap);
        return VoteRankingResponse.builder()
                .bolaCheia(mapVoteRows(voteRepository.findTopByVoteType(VoteType.BOLA_CHEIA, peladaId, page)))
                .bolaMurcha(mapVoteRows(voteRepository.findTopByVoteType(VoteType.BOLA_MURCHA, peladaId, page)))
                .build();
    }

    private List<VoteRankingEntryResponse> mapVoteRows(List<Object[]> rows) {
        return rows.stream()
                .map(row -> VoteRankingEntryResponse.builder()
                        .playerId(((Number) row[0]).longValue())
                        .playerName((String) row[1])
                        .voteCount(((Number) row[2]).longValue())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public LanceRankingsResponse lanceRankings(int limit, long peladaId) {
        int cap = Math.min(Math.max(limit, 1), 100);
        PageRequest page = PageRequest.of(0, cap);
        List<EventTypeRankingBlockResponse> blocks = new ArrayList<>();
        for (EventType type : LANCE_RANKING_ORDER) {
            List<Object[]> rows = eventRepository.findTopPlayersByEventType(type, peladaId, page);
            blocks.add(EventTypeRankingBlockResponse.builder()
                    .eventType(type.name())
                    .label(labelForEventType(type))
                    .entries(mapEventCountRows(rows))
                    .build());
        }
        return LanceRankingsResponse.builder().blocks(blocks).build();
    }

    private static String labelForEventType(EventType type) {
        return switch (type) {
            case GOAL -> "Gols";
            case ASSIST -> "Assistências";
            case YELLOW_CARD -> "Cartões amarelos";
            case RED_CARD -> "Cartões vermelhos";
            case BLUE_CARD -> "Cartões azuis";
            case FOUL -> "Faltas";
            case SUBSTITUTION -> "Substituições";
            case OTHER -> "Outros lances";
        };
    }

    private List<PlayerEventCountResponse> mapEventCountRows(List<Object[]> rows) {
        return rows.stream()
                .map(row -> PlayerEventCountResponse.builder()
                        .playerId(((Number) row[0]).longValue())
                        .playerName((String) row[1])
                        .eventCount(((Number) row[2]).longValue())
                        .build())
                .toList();
    }
}
