package com.varzeastats.repository;

import com.varzeastats.entity.MatchTeamScore;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatchTeamScoreRepository extends JpaRepository<MatchTeamScore, Long> {

    List<MatchTeamScore> findByMatch_IdOrderByTeam_IdAsc(Long matchId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM MatchTeamScore m WHERE m.match.id = :matchId")
    void deleteAllForMatch(@Param("matchId") Long matchId);
}
