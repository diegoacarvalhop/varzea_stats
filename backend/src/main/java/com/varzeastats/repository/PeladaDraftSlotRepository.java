package com.varzeastats.repository;

import com.varzeastats.entity.PeladaDraftSlot;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PeladaDraftSlotRepository extends JpaRepository<PeladaDraftSlot, Long> {

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM PeladaDraftSlot p WHERE p.pelada.id = :peladaId AND p.draftDate = :draftDate")
    int deleteByPeladaIdAndDraftDate(@Param("peladaId") Long peladaId, @Param("draftDate") LocalDate draftDate);

    List<PeladaDraftSlot> findByPelada_IdAndDraftDateOrderByTeamIndexAscIdAsc(Long peladaId, LocalDate draftDate);
}
