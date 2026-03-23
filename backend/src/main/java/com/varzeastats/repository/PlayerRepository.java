package com.varzeastats.repository;

import com.varzeastats.entity.Player;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlayerRepository extends JpaRepository<Player, Long> {

    List<Player> findByTeam_Match_IdOrderByGoalkeeperDescTeam_IdAscIdAsc(Long matchId);

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
