package com.varzeastats.repository;

import com.varzeastats.entity.Player;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlayerRepository extends JpaRepository<Player, Long> {

    List<Player> findByTeam_Match_IdOrderByGoalkeeperDescTeam_IdAscIdAsc(Long matchId);

    /**
     * Elenco de várias partidas em uma ida, com {@code team} e {@code match} inicializados (evita falhas com proxy
     * lazy ao montar DTOs) — mesmo critério de {@link #findByTeam_Match_IdOrderByGoalkeeperDescTeam_IdAscIdAsc}
     * por partida, só que em lote.
     */
    @Query(
            """
            SELECT p FROM Player p
            JOIN FETCH p.team t
            JOIN FETCH t.match m
            WHERE m.id IN :matchIds
            """)
    List<Player> findByMatch_IdInWithTeamAndMatchFetched(@Param("matchIds") Collection<Long> matchIds);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM Player p WHERE p.team.match.id = :matchId")
    void deleteByMatch_Id(@Param("matchId") Long matchId);

    @Query(
            """
            SELECT p FROM Player p
            JOIN FETCH p.team t
            JOIN FETCH t.match m
            WHERE m.pelada.id = :peladaId
            ORDER BY m.date DESC, t.name ASC, p.name ASC, p.id ASC
            """)
    List<Player> findAllForDirectoryInPelada(@Param("peladaId") Long peladaId);
}
