package com.varzeastats.repository;

import com.varzeastats.entity.Media;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MediaRepository extends JpaRepository<Media, Long> {

    List<Media> findByMatch_IdOrderByIdDesc(Long matchId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM Media m WHERE m.match.id = :matchId")
    void deleteByMatch_Id(@Param("matchId") Long matchId);
}
