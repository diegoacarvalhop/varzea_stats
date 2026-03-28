package com.varzeastats.repository;

import com.varzeastats.entity.Team;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeamRepository extends JpaRepository<Team, Long> {

    List<Team> findByMatch_IdOrderByIdAsc(Long matchId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM Team t WHERE t.match.id = :matchId")
    void deleteByMatch_Id(@Param("matchId") Long matchId);
}
