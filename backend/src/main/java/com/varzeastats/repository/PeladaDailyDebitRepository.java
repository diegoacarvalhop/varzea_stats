package com.varzeastats.repository;

import com.varzeastats.entity.PeladaDailyDebit;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PeladaDailyDebitRepository extends JpaRepository<PeladaDailyDebit, Long> {

    List<PeladaDailyDebit> findByPelada_IdAndDebitDate(Long peladaId, LocalDate debitDate);

    Optional<PeladaDailyDebit> findByPelada_IdAndUser_IdAndDebitDate(Long peladaId, Long userId, LocalDate debitDate);

    List<PeladaDailyDebit> findByPelada_IdAndUser_IdAndPaidAtIsNullOrderByDebitDateAsc(Long peladaId, Long userId);

    boolean existsByPelada_IdAndUser_IdAndPaidAtIsNull(Long peladaId, Long userId);
}
