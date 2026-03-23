package com.varzeastats.repository;

import com.varzeastats.entity.Team;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamRepository extends JpaRepository<Team, Long> {

    List<Team> findByMatch_IdOrderByIdAsc(Long matchId);
}
