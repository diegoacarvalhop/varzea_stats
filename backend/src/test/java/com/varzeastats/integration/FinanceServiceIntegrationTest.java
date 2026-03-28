package com.varzeastats.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.varzeastats.dto.PaymentRecordRequest;
import com.varzeastats.entity.PaymentKind;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.entity.UserPeladaId;
import com.varzeastats.entity.UserPeladaMembership;
import com.varzeastats.repository.AuditLogRepository;
import com.varzeastats.repository.PeladaPaymentRepository;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.UserPeladaMembershipRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.security.AppUserDetails;
import com.varzeastats.service.FinanceService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class FinanceServiceIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private FinanceService financeService;

    @Autowired
    private PeladaRepository peladaRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserPeladaMembershipRepository membershipRepository;

    @Autowired
    private PeladaPaymentRepository paymentRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Test
    void recordPayment_persistsPaymentAndAuditLog() {
        Pelada pelada = peladaRepository.save(Pelada.builder()
                .name("Pelada Finance")
                .createdAt(Instant.now())
                .active(true)
                .monthlyDueDay(15)
                .monthlyFeeCents(9000)
                .build());

        User adminGeral = userRepository.save(User.builder()
                .name("Admin Geral")
                .email("admin-finance@test.com")
                .password("x")
                .roles(Set.of(Role.ADMIN_GERAL))
                .accountActive(true)
                .build());

        User player = userRepository.save(User.builder()
                .name("Jogador")
                .email("player-finance@test.com")
                .password("x")
                .roles(Set.of(Role.PLAYER))
                .pelada(pelada)
                .accountActive(true)
                .goalkeeper(false)
                .build());

        membershipRepository.save(UserPeladaMembership.builder()
                .id(new UserPeladaId(player.getId(), pelada.getId()))
                .billingMonthly(true)
                .build());

        PaymentRecordRequest req = new PaymentRecordRequest();
        req.setPeladaId(pelada.getId());
        req.setUserId(player.getId());
        req.setKind(PaymentKind.MONTHLY);
        req.setAmountCents(9000);
        req.setPaidAt(LocalDate.of(2026, 3, 20));
        req.setReferenceMonth(LocalDate.of(2026, 3, 1));

        financeService.recordPayment(req, new AppUserDetails(adminGeral));

        assertThat(paymentRepository.findByPelada_IdAndUser_IdAndKindAndReferenceMonth(
                        pelada.getId(), player.getId(), PaymentKind.MONTHLY, LocalDate.of(2026, 3, 1)))
                .isPresent();
        assertThat(auditLogRepository.findAll().stream().anyMatch(a -> "FINANCE_RECORD_PAYMENT".equals(a.getAction())))
                .isTrue();
    }
}
