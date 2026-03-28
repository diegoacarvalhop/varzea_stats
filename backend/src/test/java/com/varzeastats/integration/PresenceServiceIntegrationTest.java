package com.varzeastats.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.varzeastats.dto.PresenceSaveRequest;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.entity.UserPeladaId;
import com.varzeastats.entity.UserPeladaMembership;
import com.varzeastats.repository.PeladaDailyDebitRepository;
import com.varzeastats.repository.PeladaPresenceRepository;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.UserPeladaMembershipRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.security.AppUserDetails;
import com.varzeastats.service.PresenceService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class PresenceServiceIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    private PresenceService presenceService;

    @Autowired
    private PeladaRepository peladaRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserPeladaMembershipRepository membershipRepository;

    @Autowired
    private PeladaPresenceRepository presenceRepository;

    @Autowired
    private PeladaDailyDebitRepository dailyDebitRepository;

    @Test
    void save_createsPresenceAndDailyDebitForDiarista() {
        Pelada pelada = peladaRepository.save(Pelada.builder()
                .name("Pelada Integra")
                .createdAt(Instant.now())
                .active(true)
                .dailyFeeCents(1700)
                .monthlyDueDay(15)
                .build());

        User admin = userRepository.save(User.builder()
                .name("Admin")
                .email("admin-presence@test.com")
                .password("x")
                .roles(Set.of(Role.ADMIN))
                .pelada(pelada)
                .accountActive(true)
                .build());

        User diarista = userRepository.save(User.builder()
                .name("Diarista")
                .email("diarista@test.com")
                .password("x")
                .roles(Set.of(Role.PLAYER))
                .pelada(pelada)
                .accountActive(true)
                .goalkeeper(false)
                .build());

        membershipRepository.save(UserPeladaMembership.builder()
                .id(new UserPeladaId(diarista.getId(), pelada.getId()))
                .billingMonthly(false)
                .build());

        PresenceSaveRequest request = new PresenceSaveRequest();
        request.setDate(LocalDate.of(2026, 3, 27));
        request.setPresentUserIds(List.of(diarista.getId()));

        Authentication auth = new UsernamePasswordAuthenticationToken(new AppUserDetails(admin), null, List.of());
        presenceService.save(pelada.getId(), request, auth);

        assertThat(presenceRepository.findByPelada_IdAndPresenceDate(pelada.getId(), request.getDate()))
                .hasSize(1);
        assertThat(dailyDebitRepository.findByPelada_IdAndUser_IdAndDebitDate(
                        pelada.getId(), diarista.getId(), request.getDate()))
                .isPresent()
                .get()
                .extracting("amountCents")
                .isEqualTo(1700);
    }
}
