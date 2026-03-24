package com.varzeastats.repository;

import com.varzeastats.entity.Event;
import com.varzeastats.entity.EventType;
import com.varzeastats.entity.Player;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventRepository extends JpaRepository<Event, Long> {

    @Query(
            value =
                    """
            SELECT t.id, t.name, COALESCE(COUNT(e.id), 0)
            FROM teams t
            LEFT JOIN players p ON p.team_id = t.id
            LEFT JOIN events e ON e.player_id = p.id AND e.match_id = :matchId AND e.type = 'GOAL'
            WHERE t.match_id = :matchId
            GROUP BY t.id, t.name
            ORDER BY t.id
            """,
            nativeQuery = true)
    List<Object[]> sumGoalsByTeamForMatch(@Param("matchId") long matchId);

    @Modifying
    @Query("UPDATE Event e SET e.player = null WHERE e.player.id = :playerId")
    void clearPlayerAsMain(@Param("playerId") Long playerId);

    @Modifying
    @Query("UPDATE Event e SET e.target = null WHERE e.target.id = :playerId")
    void clearPlayerAsTarget(@Param("playerId") Long playerId);

    List<Event> findByPlayer(Player player);

    long countByPlayerAndType(Player player, EventType type);

    List<Event> findByMatch_IdOrderByIdDesc(Long matchId);

    @Query(
            """
            SELECT e.player.id, e.player.name, COUNT(e.id)
            FROM Event e
            WHERE e.type = :type AND e.player IS NOT NULL AND e.match.pelada.id = :peladaId
            GROUP BY e.player.id, e.player.name
            ORDER BY COUNT(e.id) DESC
            """)
    List<Object[]> findTopPlayersByEventType(
            @Param("type") EventType type, @Param("peladaId") long peladaId, Pageable pageable);

    @Query(
            """
            SELECT e.target.id, e.target.name, COUNT(e.id)
            FROM Event e
            WHERE e.type = com.varzeastats.entity.EventType.FOUL AND e.target IS NOT NULL AND e.match.pelada.id = :peladaId
            GROUP BY e.target.id, e.target.name
            ORDER BY COUNT(e.id) DESC
            """)
    List<Object[]> findTopPlayersByFoulsSuffered(@Param("peladaId") long peladaId, Pageable pageable);

    @Query(
            value =
                    """
            SELECT gk.id, gk.name,
                COALESCE(SUM(
                    CASE
                        WHEN e.type = 'GOAL' AND p_main.team_id <> gk.team_id THEN 1
                        WHEN e.type = 'OWN_GOAL' AND p_main.team_id = gk.team_id THEN 1
                        ELSE 0
                    END
                ), 0) AS conceded
            FROM players gk
            JOIN teams t ON t.id = gk.team_id
            JOIN matches m ON m.id = t.match_id
            LEFT JOIN events e
                ON e.match_id = m.id
               AND e.player_id IS NOT NULL
               AND e.type IN ('GOAL', 'OWN_GOAL')
            LEFT JOIN players p_main ON p_main.id = e.player_id
            WHERE m.pelada_id = :peladaId
              AND gk.goalkeeper = true
            GROUP BY gk.id, gk.name
            HAVING COALESCE(SUM(
                    CASE
                        WHEN e.type = 'GOAL' AND p_main.team_id <> gk.team_id THEN 1
                        WHEN e.type = 'OWN_GOAL' AND p_main.team_id = gk.team_id THEN 1
                        ELSE 0
                    END
                ), 0) > 0
            ORDER BY conceded DESC, gk.name ASC
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
                COALESCE(SUM(CASE WHEN e.type = 'OTHER' THEN 1 ELSE 0 END), 0)
            FROM events e
            INNER JOIN players p ON e.player_id = p.id
            INNER JOIN matches m ON e.match_id = m.id
            WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(:playerName)) AND m.pelada_id = :peladaId
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
            SELECT m.id, m.date, m.location,
                COALESCE(SUM(
                    CASE
                        WHEN e.type = 'GOAL' AND p_main.team_id <> t_gk.id THEN 1
                        WHEN e.type = 'OWN_GOAL' AND p_main.team_id = t_gk.id THEN 1
                        ELSE 0
                    END
                ), 0) AS conceded
            FROM matches m
            JOIN teams t_gk ON t_gk.match_id = m.id
            JOIN players p_gk ON p_gk.team_id = t_gk.id AND p_gk.goalkeeper = true
            LEFT JOIN events e ON e.match_id = m.id AND e.type IN ('GOAL', 'OWN_GOAL') AND e.player_id IS NOT NULL
            LEFT JOIN players p_main ON p_main.id = e.player_id
            WHERE m.pelada_id = :peladaId
              AND LOWER(TRIM(p_gk.name)) = LOWER(TRIM(:playerName))
            GROUP BY m.id, m.date, m.location
            HAVING COALESCE(SUM(
                    CASE
                        WHEN e.type = 'GOAL' AND p_main.team_id <> t_gk.id THEN 1
                        WHEN e.type = 'OWN_GOAL' AND p_main.team_id = t_gk.id THEN 1
                        ELSE 0
                    END
                ), 0) > 0
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
            JOIN players p_main ON e.player_id = p_main.id
            WHERE m.pelada_id = :peladaId
              AND (
                    (e.type = 'GOAL' AND EXISTS (
                        SELECT 1
                        FROM teams t_gk
                        JOIN players p_gk ON p_gk.team_id = t_gk.id
                        WHERE t_gk.match_id = m.id
                          AND p_gk.goalkeeper = true
                          AND LOWER(TRIM(p_gk.name)) = LOWER(TRIM(:playerName))
                          AND p_main.team_id <> t_gk.id
                    ))
                    OR
                    (e.type = 'OWN_GOAL' AND EXISTS (
                        SELECT 1
                        FROM teams t_gk
                        JOIN players p_gk ON p_gk.team_id = t_gk.id
                        WHERE t_gk.match_id = m.id
                          AND p_gk.goalkeeper = true
                          AND LOWER(TRIM(p_gk.name)) = LOWER(TRIM(:playerName))
                          AND p_main.team_id = t_gk.id
                    ))
              )
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
              AND e.type = 'FOUL'
              AND LOWER(TRIM(p_target.name)) = LOWER(TRIM(:playerName))
            """,
            nativeQuery = true)
    long countFoulsSufferedByPlayerNameInPelada(
            @Param("playerName") String playerName, @Param("peladaId") long peladaId);
}
