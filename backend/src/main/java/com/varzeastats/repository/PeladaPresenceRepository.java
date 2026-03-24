package com.varzeastats.repository;

import com.varzeastats.entity.PeladaPresence;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PeladaPresenceRepository extends JpaRepository<PeladaPresence, Long> {

    List<PeladaPresence> findByPelada_IdAndPresenceDate(Long peladaId, LocalDate date);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM PeladaPresence p WHERE p.pelada.id = :peladaId AND p.presenceDate = :presenceDate")
    int deleteByPeladaIdAndPresenceDate(
            @Param("peladaId") Long peladaId, @Param("presenceDate") LocalDate presenceDate);
}
