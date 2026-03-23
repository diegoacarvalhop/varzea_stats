package com.varzeastats.repository;

import com.varzeastats.entity.Player;
import com.varzeastats.entity.Vote;
import com.varzeastats.entity.VoteType;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VoteRepository extends JpaRepository<Vote, Long> {

    long countByPlayerAndType(Player player, VoteType type);

    void deleteByPlayer_Id(Long playerId);

    @Query(
            """
            SELECT v.player.id, v.player.name, COUNT(v.id)
            FROM Vote v
            JOIN v.player p
            JOIN p.team t
            JOIN t.match m
            WHERE v.type = :type AND m.pelada.id = :peladaId
            GROUP BY v.player.id, v.player.name
            ORDER BY COUNT(v.id) DESC
            """)
    List<Object[]> findTopByVoteType(
            @Param("type") VoteType type, @Param("peladaId") long peladaId, Pageable pageable);
}
