package com.varzeastats.repository;

import com.varzeastats.entity.PeladaDelinquentReminder;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PeladaDelinquentReminderRepository extends JpaRepository<PeladaDelinquentReminder, Long> {

    Optional<PeladaDelinquentReminder> findByPelada_IdAndUser_IdAndReferenceMonth(
            Long peladaId, Long userId, LocalDate referenceMonth);
}
