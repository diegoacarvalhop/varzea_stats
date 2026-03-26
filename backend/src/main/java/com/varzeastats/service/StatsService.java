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
import java.util.Comparator;
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
            EventType.PENALTY_PLAY,
            EventType.OWN_GOAL,
            EventType.ASSIST,
            EventType.YELLOW_CARD,
            EventType.RED_CARD,
            EventType.BLUE_CARD,
            EventType.FOUL,
            EventType.OTHER);

    private static final List<EventType> COUNTED_PLAYER_STATS_TYPES = List.of(
            EventType.GOAL,
            EventType.PENALTY_PLAY,
            EventType.OWN_GOAL,
            EventType.ASSIST,
            EventType.YELLOW_CARD,
            EventType.RED_CARD,
            EventType.BLUE_CARD,
            EventType.FOUL,
            EventType.OTHER);

    private static final List<String> FORECAST_EVENT_KEYS = List.of(
            "GOAL",
            "PENALTY_PLAY",
            "OWN_GOAL",
            "ASSIST",
            "YELLOW_CARD",
            "RED_CARD",
            "BLUE_CARD",
            "FOUL",
            "FOULS_SUFFERED",
            "OTHER",
            "GOALS_CONCEDED");

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
        for (EventType t : COUNTED_PLAYER_STATS_TYPES) {
            byType.put(t.name(), eventRepository.countByPlayerAndType(player, t));
        }
        long cheia = voteRepository.countByPlayerAndType(player, VoteType.BOLA_CHEIA);
        long murcha = voteRepository.countByPlayerAndType(player, VoteType.BOLA_MURCHA);
        long goalsConceded = eventRepository.countGoalsConcededByGoalkeeperNameInPelada(player.getName(), peladaId);
        long foulsSuffered = eventRepository.countFoulsSufferedByPlayerNameInPelada(player.getName(), peladaId);
        Long teamId = player.getTeam() != null ? player.getTeam().getId() : null;
        String teamName = player.getTeam() != null ? player.getTeam().getName() : null;
        return PlayerStatsResponse.builder()
                .playerId(player.getId())
                .playerName(player.getName())
                .teamId(teamId)
                .teamName(teamName)
                .goalkeeper(player.isGoalkeeper())
                .goalsConceded(goalsConceded)
                .foulsSuffered(foulsSuffered)
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
        List<Object[]> rowsMain = eventRepository.aggregateMainPlayerEventsByMatchForName(nameKey, peladaId);
        List<Object[]> rowsGkConceded = eventRepository.aggregateGoalsConcededByMatchForGoalkeeperName(nameKey, peladaId);
        List<Object[]> rowsFoulsSuffered = eventRepository.aggregateFoulsSufferedByMatchForName(nameKey, peladaId);
        Map<Long, MutableSlice> grouped = new LinkedHashMap<>();
        for (Object[] row : rowsMain) {
            Long mid = ((Number) row[0]).longValue();
            MutableSlice slice = grouped.computeIfAbsent(mid, k -> new MutableSlice());
            slice.matchId = mid;
            slice.matchDate = instantFromNativeQuery(row[1]);
            slice.matchLocation = row[2] != null ? row[2].toString() : "";
            slice.goals = ((Number) row[3]).longValue();
            slice.ownGoals = ((Number) row[4]).longValue();
            slice.assists = ((Number) row[5]).longValue();
            slice.yellowCards = ((Number) row[6]).longValue();
            slice.redCards = ((Number) row[7]).longValue();
            slice.blueCards = ((Number) row[8]).longValue();
            slice.fouls = ((Number) row[9]).longValue();
            slice.penalties = ((Number) row[10]).longValue();
            slice.otherEvents = ((Number) row[11]).longValue();
        }
        for (Object[] row : rowsGkConceded) {
            Long mid = ((Number) row[0]).longValue();
            MutableSlice slice = grouped.computeIfAbsent(mid, k -> new MutableSlice());
            slice.matchId = mid;
            slice.matchDate = instantFromNativeQuery(row[1]);
            slice.matchLocation = row[2] != null ? row[2].toString() : "";
            slice.goalsConceded = ((Number) row[3]).longValue();
        }
        for (Object[] row : rowsFoulsSuffered) {
            Long mid = ((Number) row[0]).longValue();
            MutableSlice slice = grouped.computeIfAbsent(mid, k -> new MutableSlice());
            slice.matchId = mid;
            slice.matchDate = instantFromNativeQuery(row[1]);
            slice.matchLocation = row[2] != null ? row[2].toString() : "";
            slice.foulsSuffered = ((Number) row[3]).longValue();
        }
        List<TrajectoryMatchSliceResponse> slices = grouped.values().stream()
                .sorted(Comparator.comparing((MutableSlice s) -> s.matchDate))
                .map(MutableSlice::toDto)
                .toList();
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
                    .averageByEventPerMatch(Map.of())
                    .estimatedByEventNextMatch(Map.of())
                    .narrative("Ainda não há partidas com lances registrados para jogadores com este nome.")
                    .build();
        }
        int n = slices.size();
        int window = Math.min(5, n);
        List<TrajectoryMatchSliceResponse> tail = slices.subList(n - window, n);
        Map<String, Double> averages = new LinkedHashMap<>();
        Map<String, Integer> estimates = new LinkedHashMap<>();
        for (String key : FORECAST_EVENT_KEYS) {
            double avg = slices.stream().mapToLong(s -> eventCountForKey(s, key)).average().orElse(0);
            double recent = tail.stream().mapToLong(s -> eventCountForKey(s, key)).average().orElse(avg);
            averages.put(key, round1(avg));
            estimates.put(key, (int) Math.round(recent));
        }
        List<Long> goalsSeries = slices.stream().map(TrajectoryMatchSliceResponse::getGoals).toList();
        String trendCode = trendGoals(goalsSeries);
        String trendPt =
                switch (trendCode) {
                    case "UP" -> "em alta";
                    case "DOWN" -> "em baixa";
                    default -> "estável";
                };
        String narrative = String.format(
                "Foram consideradas %d partida(s) em que há lance com este nome. "
                        + "As médias e estimativas abaixo cobrem todos os eventos contabilizados (linha e goleiro), "
                        + "com base na média móvel das últimas %d partidas. Tendência de gols: %s.",
                n, window, trendPt);
        return PlayerTrajectoryForecastResponse.builder()
                .averageGoalsPerMatch(averages.getOrDefault("GOAL", 0.0))
                .estimatedGoalsNextMatch(estimates.getOrDefault("GOAL", 0))
                .averageAssistsPerMatch(averages.getOrDefault("ASSIST", 0.0))
                .estimatedAssistsNextMatch(estimates.getOrDefault("ASSIST", 0))
                .averageByEventPerMatch(averages)
                .estimatedByEventNextMatch(estimates)
                .goalsTrendLabel(trendPt)
                .narrative(narrative)
                .methodologyNote(TRAJECTORY_METHODOLOGY)
                .build();
    }

    private static long eventCountForKey(TrajectoryMatchSliceResponse s, String key) {
        return switch (key) {
            case "GOAL" -> s.getGoals();
            case "OWN_GOAL" -> s.getOwnGoals();
            case "ASSIST" -> s.getAssists();
            case "YELLOW_CARD" -> s.getYellowCards();
            case "RED_CARD" -> s.getRedCards();
            case "BLUE_CARD" -> s.getBlueCards();
            case "FOUL" -> s.getFouls();
            case "PENALTY_PLAY" -> s.getPenalties();
            case "FOULS_SUFFERED" -> s.getFoulsSuffered();
            case "OTHER" -> s.getOtherEvents();
            case "GOALS_CONCEDED" -> s.getGoalsConceded();
            default -> 0;
        };
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
        blocks.add(EventTypeRankingBlockResponse.builder()
                .eventType("GOALS_CONCEDED")
                .label("Gols sofridos (goleiros)")
                .entries(mapEventCountRows(eventRepository.findGoalkeepersByGoalsConceded(peladaId), cap))
                .build());
        blocks.add(EventTypeRankingBlockResponse.builder()
                .eventType("FOULS_SUFFERED")
                .label("Faltas sofridas")
                .entries(mapEventCountRows(eventRepository.findTopPlayersByFoulsSuffered(peladaId, page)))
                .build());
        return LanceRankingsResponse.builder().blocks(blocks).build();
    }

    private static String labelForEventType(EventType type) {
        return switch (type) {
            case GOAL -> "Gols";
            case OWN_GOAL -> "Gols contra";
            case ASSIST -> "Assistências";
            case YELLOW_CARD -> "Cartões amarelos";
            case RED_CARD -> "Cartões vermelhos";
            case BLUE_CARD -> "Cartões azuis";
            case FOUL -> "Faltas";
            case PENALTY_PLAY -> "Pênaltis (durante jogo)";
            case PENALTY -> "Pênaltis (desempate)";
            case OTHER -> "Outros lances";
            case SUBSTITUTION -> "Substituições";
        };
    }

    private List<PlayerEventCountResponse> mapEventCountRows(List<Object[]> rows) {
        return mapEventCountRows(rows, rows.size());
    }

    private List<PlayerEventCountResponse> mapEventCountRows(List<Object[]> rows, int limit) {
        return rows.stream()
                .limit(Math.max(limit, 0))
                .map(row -> PlayerEventCountResponse.builder()
                        .playerId(((Number) row[0]).longValue())
                        .playerName((String) row[1])
                        .eventCount(((Number) row[2]).longValue())
                        .build())
                .toList();
    }

    private static final class MutableSlice {
        private Long matchId;
        private Instant matchDate = Instant.EPOCH;
        private String matchLocation = "";
        private long goals;
        private long ownGoals;
        private long assists;
        private long yellowCards;
        private long redCards;
        private long blueCards;
        private long fouls;
        private long penalties;
        private long foulsSuffered;
        private long otherEvents;
        private long goalsConceded;

        private TrajectoryMatchSliceResponse toDto() {
            return TrajectoryMatchSliceResponse.builder()
                    .matchId(matchId)
                    .matchDate(matchDate)
                    .matchLocation(matchLocation)
                    .goals(goals)
                    .ownGoals(ownGoals)
                    .assists(assists)
                    .yellowCards(yellowCards)
                    .redCards(redCards)
                    .blueCards(blueCards)
                    .fouls(fouls)
                    .penalties(penalties)
                    .foulsSuffered(foulsSuffered)
                    .otherEvents(otherEvents)
                    .goalsConceded(goalsConceded)
                    .build();
        }
    }
}
