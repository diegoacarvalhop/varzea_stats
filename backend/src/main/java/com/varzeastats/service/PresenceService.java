package com.varzeastats.service;

import com.varzeastats.dto.PresenceSaveRequest;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.PeladaDailyDebit;
import com.varzeastats.entity.PeladaPresence;
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
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PresenceService {

    private static final int DEFAULT_DAILY_FEE_CENTS = 1000;

    private final PeladaPresenceRepository peladaPresenceRepository;
    private final PeladaRepository peladaRepository;
    private final UserRepository userRepository;
    private final UserPeladaMembershipRepository userPeladaMembershipRepository;
    private final PeladaDailyDebitRepository peladaDailyDebitRepository;

    @Transactional(readOnly = true)
    public List<Long> listPresent(Long peladaId, LocalDate date, Authentication authentication) {
        authorize(authentication, peladaId);
        return peladaPresenceRepository.findByPelada_IdAndPresenceDate(peladaId, date).stream()
                .filter(PeladaPresence::isPresent)
                .map(p -> p.getUser().getId())
                .toList();
    }

    @Transactional
    public void save(Long peladaId, PresenceSaveRequest body, Authentication authentication) {
        authorize(authentication, peladaId);
        Pelada pelada = peladaRepository
                .findById(peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
        int dailyFee =
                pelada.getDailyFeeCents() != null && pelada.getDailyFeeCents() > 0
                        ? pelada.getDailyFeeCents()
                        : DEFAULT_DAILY_FEE_CENTS;
        peladaPresenceRepository.deleteByPeladaIdAndPresenceDate(peladaId, body.getDate());
        List<Long> distinctUserIds = body.getPresentUserIds().stream().distinct().toList();
        Set<Long> diaristaPresentIds = new HashSet<>();
        for (Long uid : distinctUserIds) {
            UserPeladaMembership membership = userPeladaMembershipRepository
                    .findById(new UserPeladaId(uid, peladaId))
                    .orElseThrow(() -> new IllegalArgumentException("Usuário não é membro desta pelada: " + uid));
            User user = userRepository
                    .findById(uid)
                    .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado: " + uid));
            peladaPresenceRepository.save(PeladaPresence.builder()
                    .pelada(pelada)
                    .user(user)
                    .presenceDate(body.getDate())
                    .present(true)
                    .build());
            if (!membership.isBillingMonthly()
                    && user.getRoles() != null
                    && user.getRoles().contains(Role.PLAYER)
                    && !user.isGoalkeeper()) {
                diaristaPresentIds.add(uid);
                ensureDailyDebit(peladaId, pelada, user, body.getDate(), dailyFee);
            }
        }
        cleanupRemovedDailyDebits(peladaId, body.getDate(), diaristaPresentIds);
    }

    private void ensureDailyDebit(Long peladaId, Pelada pelada, User user, LocalDate date, int dailyFee) {
        peladaDailyDebitRepository
                .findByPelada_IdAndUser_IdAndDebitDate(peladaId, user.getId(), date)
                .or(() -> java.util.Optional.of(PeladaDailyDebit.builder()
                        .pelada(pelada)
                        .user(user)
                        .debitDate(date)
                        .amountCents(dailyFee)
                        .build()))
                .ifPresent(debit -> {
                    if (debit.getId() == null) {
                        peladaDailyDebitRepository.save(debit);
                    }
                });
    }

    private void cleanupRemovedDailyDebits(Long peladaId, LocalDate date, Set<Long> diaristaPresentIds) {
        for (PeladaDailyDebit debit : peladaDailyDebitRepository.findByPelada_IdAndDebitDate(peladaId, date)) {
            if (debit.getPaidAt() == null && !diaristaPresentIds.contains(debit.getUser().getId())) {
                peladaDailyDebitRepository.delete(debit);
            }
        }
    }

    private static void authorize(Authentication authentication, Long peladaId) {
        AppUserDetails user = (AppUserDetails) authentication.getPrincipal();
        if (user.isAdminGeral()) {
            return;
        }
        if ((user.hasRole(Role.ADMIN)
                        || user.hasRole(Role.SCOUT)
                        || user.hasRole(Role.MEDIA)
                        || user.hasRole(Role.FINANCEIRO))
                && user.getPeladaId() != null
                && user.getPeladaId().equals(peladaId)) {
            return;
        }
        throw new AccessDeniedException("Sem permissão na pelada.");
    }
}
