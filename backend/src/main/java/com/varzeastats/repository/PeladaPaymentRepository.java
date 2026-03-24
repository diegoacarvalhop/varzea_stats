package com.varzeastats.repository;

import com.varzeastats.entity.PaymentKind;
import com.varzeastats.entity.PeladaPayment;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PeladaPaymentRepository extends JpaRepository<PeladaPayment, Long> {

    Optional<PeladaPayment> findByPelada_IdAndUser_IdAndKindAndReferenceMonth(
            Long peladaId, Long userId, PaymentKind kind, LocalDate referenceMonth);

    List<PeladaPayment> findByPelada_IdAndReferenceMonth(Long peladaId, LocalDate referenceMonth);
    List<PeladaPayment> findByPelada_IdAndUser_IdAndKindOrderByReferenceMonthDescPaidAtDescIdDesc(
            Long peladaId, Long userId, PaymentKind kind);

    @Query(
            """
            SELECT CASE WHEN COUNT(p) > 0 THEN true ELSE false END
            FROM PeladaPayment p
            WHERE p.pelada.id = :peladaId
              AND p.user.id = :userId
              AND p.kind = :kind
              AND p.referenceMonth = :monthStart
            """)
    boolean hasMonthlyPaymentForMonth(
            @Param("peladaId") Long peladaId,
            @Param("userId") Long userId,
            @Param("kind") PaymentKind kind,
            @Param("monthStart") LocalDate monthStart);
}
