package com.varzeastats.repository;

import com.varzeastats.entity.Event;
import com.varzeastats.entity.EventType;
import com.varzeastats.entity.Player;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventRepository extends JpaRepository<Event, Long> {

    /**
     * Gols a favor por equipe: {@code GOAL}/{@code PENALTY_PLAY} contam para o time do artilheiro;
     * {@code OWN_GOAL} conta para o adversário (partidas com exatamente dois times na partida).
     */
    @Query(
            value =
                    """
            SELECT t.id, t.name,
                COALESCE((
                    SELECT COUNT(e.id)
                    FROM events e
                    INNER JOIN players p ON e.player_id = p.id
                    WHERE e.match_id = :matchId
                      AND e.type IN ('GOAL', 'PENALTY_PLAY')
                      AND p.team_id = t.id
                ), 0)
                + COALESCE((
                    SELECT COUNT(e.id)
                    FROM events e
                    INNER JOIN players p ON e.player_id = p.id
                    WHERE e.match_id = :matchId
                      AND e.type = 'OWN_GOAL'
                      AND p.team_id <> t.id
                      AND (SELECT COUNT(*) FROM teams t2 WHERE t2.match_id = :matchId) = 2
                ), 0) AS goals
            FROM teams t
            WHERE t.match_id = :matchId
            ORDER BY t.id
            """,
            nativeQuery = true)
    List<Object[]> sumGoalsByTeamForMatch(@Param("matchId") long matchId);

    /**
     * Mesma regra de {@link #sumGoalsByTeamForMatch(long)}, em lote, para evitar N+1 na listagem de partidas.
     * Colunas: {@code match_id}, {@code team_id}, {@code team_name}, {@code goals}.
     */
    @Query(
            value =
                    """
            SELECT t.match_id, t.id, t.name,
                COALESCE((
                    SELECT COUNT(e.id)
                    FROM events e
                    INNER JOIN players p ON e.player_id = p.id
                    WHERE e.match_id = t.match_id
                      AND e.type IN ('GOAL', 'PENALTY_PLAY')
                      AND p.team_id = t.id
                ), 0)
                + COALESCE((
                    SELECT COUNT(e.id)
                    FROM events e
                    INNER JOIN players p ON e.player_id = p.id
                    WHERE e.match_id = t.match_id
                      AND e.type = 'OWN_GOAL'
                      AND p.team_id <> t.id
                      AND (SELECT COUNT(*) FROM teams t2 WHERE t2.match_id = t.match_id) = 2
                ), 0) AS goals
            FROM teams t
            WHERE t.match_id IN (:matchIds)
            ORDER BY t.match_id, t.id
            """,
            nativeQuery = true)
    List<Object[]> sumGoalsByTeamForMatchIds(@Param("matchIds") Collection<Long> matchIds);

    @Modifying
    @Query("UPDATE Event e SET e.player = null WHERE e.player.id = :playerId")
    void clearPlayerAsMain(@Param("playerId") Long playerId);

    @Modifying
    @Query("UPDATE Event e SET e.target = null WHERE e.target.id = :playerId")
    void clearPlayerAsTarget(@Param("playerId") Long playerId);

    List<Event> findByPlayer(Player player);

    long countByPlayerAndType(Player player, EventType type);

    /** Contagem só em partidas encerradas normalmente (não canceladas). */
    @Query(
            """
            SELECT COUNT(e) FROM Event e
            WHERE e.player = :player AND e.type = :type
            AND e.match.finishedAt IS NOT NULL
            AND e.match.cancelledAt IS NULL
            """)
    long countByPlayerAndTypeFinishedMatchOnly(
            @Param("player") Player player, @Param("type") EventType type);

    List<Event> findByMatch_IdOrderByIdDesc(Long matchId);

    Optional<Event> findFirstByMatch_IdOrderByIdDesc(Long matchId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM Event e WHERE e.match.id = :matchId")
    void deleteByMatch_Id(@Param("matchId") Long matchId);

    /**
     * Soma lances por jogador principal agregando pelo nome (mesmo cadastro em partidas diferentes =
     * um único {@code players.id} por partida).
     */
    @Query(
            value =
                    """
            SELECT MIN(p.id), MAX(p.name), COUNT(e.id)
            FROM events e
            INNER JOIN players p ON e.player_id = p.id
            INNER JOIN teams t ON p.team_id = t.id
            INNER JOIN matches m ON t.match_id = m.id
            WHERE e.type = :eventType AND m.pelada_id = :peladaId
              AND m.finished_at IS NOT NULL
              AND m.cancelled_at IS NULL
            GROUP BY LOWER(TRIM(p.name))
            ORDER BY COUNT(e.id) DESC
            """,
            nativeQuery = true)
    List<Object[]> findTopPlayersByEventType(
            @Param("eventType") String eventType, @Param("peladaId") long peladaId, Pageable pageable);

    @Query(
            value =
                    """
            SELECT MIN(p.id), MAX(p.name), COUNT(e.id)
            FROM events e
            INNER JOIN players p ON e.target_id = p.id
            INNER JOIN teams t ON p.team_id = t.id
            INNER JOIN matches m ON t.match_id = m.id
            WHERE e.type = 'FOUL' AND m.pelada_id = :peladaId
              AND m.finished_at IS NOT NULL
              AND m.cancelled_at IS NULL
            GROUP BY LOWER(TRIM(p.name))
            ORDER BY COUNT(e.id) DESC
            """,
            nativeQuery = true)
    List<Object[]> findTopPlayersByFoulsSuffered(@Param("peladaId") long peladaId, Pageable pageable);

    @Query(
            value =
                    """
            SELECT MIN(gk.id), MAX(gk.name), COALESCE(COUNT(e.id), 0) AS conceded
            FROM players gk
            INNER JOIN teams t ON t.id = gk.team_id
            INNER JOIN matches m ON m.id = t.match_id
            LEFT JOIN events e ON e.target_id = gk.id AND e.type IN ('GOAL', 'OWN_GOAL', 'PENALTY_PLAY')
            WHERE m.pelada_id = :peladaId
              AND m.finished_at IS NOT NULL
              AND m.cancelled_at IS NULL
              AND gk.goalkeeper = true
            GROUP BY LOWER(TRIM(gk.name))
            HAVING COALESCE(COUNT(e.id), 0) > 0
            ORDER BY conceded DESC, MAX(gk.name) ASC
            """,
            nativeQuery = true)
    List<Object[]> findGoalkeepersByGoalsConceded(@Param("peladaId") long peladaId);

    @Query(
            value =
                    """
            SELECT m.id, m.date, m.location,
                COALESCE(SUM(CASE WHEN e.type = 'GOAL' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'OWN_GOAL' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'ASSIST' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'YELLOW_CARD' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'RED_CARD' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'BLUE_CARD' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'FOUL' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'PENALTY_PLAY' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'OTHER' THEN 1 ELSE 0 END), 0)
            FROM events e
            INNER JOIN players p ON e.player_id = p.id
            INNER JOIN matches m ON e.match_id = m.id
            WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(:playerName)) AND m.pelada_id = :peladaId
              AND m.finished_at IS NOT NULL
              AND m.cancelled_at IS NULL
            GROUP BY m.id, m.date, m.location
            ORDER BY m.date ASC
            """,
            nativeQuery = true)
    List<Object[]> aggregateMainPlayerEventsByMatchForName(
            @Param("playerName") String playerName, @Param("peladaId") long peladaId);

    @Query(
            value =
                    """
            SELECT m.id, m.date, m.location, COALESCE(COUNT(e.id), 0)
            FROM matches m
            JOIN events e ON e.match_id = m.id
            JOIN players p_target ON p_target.id = e.target_id
            WHERE m.pelada_id = :peladaId
              AND m.finished_at IS NOT NULL
              AND m.cancelled_at IS NULL
              AND e.type = 'FOUL'
              AND LOWER(TRIM(p_target.name)) = LOWER(TRIM(:playerName))
            GROUP BY m.id, m.date, m.location
            ORDER BY m.date ASC
            """,
            nativeQuery = true)
    List<Object[]> aggregateFoulsSufferedByMatchForName(
            @Param("playerName") String playerName, @Param("peladaId") long peladaId);

    @Query(
            value =
                    """
            SELECT m.id, m.date, m.location, COALESCE(COUNT(e.id), 0) AS conceded
            FROM matches m
            JOIN teams t_gk ON t_gk.match_id = m.id
            JOIN players p_gk ON p_gk.team_id = t_gk.id AND p_gk.goalkeeper = true
            LEFT JOIN events e ON e.target_id = p_gk.id AND e.type IN ('GOAL', 'OWN_GOAL', 'PENALTY_PLAY')
            WHERE m.pelada_id = :peladaId
              AND m.finished_at IS NOT NULL
              AND m.cancelled_at IS NULL
              AND LOWER(TRIM(p_gk.name)) = LOWER(TRIM(:playerName))
            GROUP BY m.id, m.date, m.location
            HAVING COALESCE(COUNT(e.id), 0) > 0
            ORDER BY m.date ASC
            """,
            nativeQuery = true)
    List<Object[]> aggregateGoalsConcededByMatchForGoalkeeperName(
            @Param("playerName") String playerName, @Param("peladaId") long peladaId);

    @Query(
            value =
                    """
            SELECT COALESCE(COUNT(e.id), 0)
            FROM events e
            JOIN matches m ON e.match_id = m.id
            JOIN players p_target ON e.target_id = p_target.id
            WHERE m.pelada_id = :peladaId
              AND m.finished_at IS NOT NULL
              AND m.cancelled_at IS NULL
              AND e.type IN ('GOAL', 'OWN_GOAL', 'PENALTY_PLAY')
              AND LOWER(TRIM(p_target.name)) = LOWER(TRIM(:playerName))
            """,
            nativeQuery = true)
    long countGoalsConcededByGoalkeeperNameInPelada(
            @Param("playerName") String playerName, @Param("peladaId") long peladaId);

    @Query(
            value =
                    """
            SELECT COALESCE(COUNT(e.id), 0)
            FROM events e
            JOIN matches m ON e.match_id = m.id
            JOIN players p_target ON p_target.id = e.target_id
            WHERE m.pelada_id = :peladaId
              AND m.finished_at IS NOT NULL
              AND m.cancelled_at IS NULL
              AND e.type = 'FOUL'
              AND LOWER(TRIM(p_target.name)) = LOWER(TRIM(:playerName))
            """,
            nativeQuery = true)
    long countFoulsSufferedByPlayerNameInPelada(
            @Param("playerName") String playerName, @Param("peladaId") long peladaId);
}
