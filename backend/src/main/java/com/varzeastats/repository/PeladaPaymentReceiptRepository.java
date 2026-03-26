package com.varzeastats.repository;

import com.varzeastats.entity.PaymentReceiptStatus;
import com.varzeastats.entity.PeladaPaymentReceipt;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PeladaPaymentReceiptRepository extends JpaRepository<PeladaPaymentReceipt, Long> {

    List<PeladaPaymentReceipt> findByPelada_IdAndStatusOrderBySubmittedAtDesc(Long peladaId, PaymentReceiptStatus status);

    List<PeladaPaymentReceipt> findByPelada_IdAndUser_IdOrderBySubmittedAtDesc(Long peladaId, Long userId);

    Optional<PeladaPaymentReceipt> findFirstByPelada_IdAndUser_IdAndStatusOrderBySubmittedAtDesc(
            Long peladaId, Long userId, PaymentReceiptStatus status);
}
