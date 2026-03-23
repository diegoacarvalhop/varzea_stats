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
            value =
                    """
            SELECT m.id, m.date, m.location,
                COALESCE(SUM(CASE WHEN e.type = 'GOAL' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'ASSIST' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'YELLOW_CARD' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'RED_CARD' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'BLUE_CARD' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN e.type = 'FOUL' THEN 1 ELSE 0 END), 0)
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
}
