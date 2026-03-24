package com.varzeastats.controller;

import com.varzeastats.dto.PresenceSaveRequest;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.PeladaPresence;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.entity.UserPeladaId;
import com.varzeastats.entity.UserPeladaMembership;
import com.varzeastats.entity.PeladaDailyDebit;
import com.varzeastats.repository.PeladaDailyDebitRepository;
import com.varzeastats.repository.PeladaPresenceRepository;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.UserPeladaMembershipRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.security.AppUserDetails;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/peladas/{peladaId}/presence")
@RequiredArgsConstructor
public class PeladaPresenceController {

    private final PeladaPresenceRepository peladaPresenceRepository;
    private final PeladaRepository peladaRepository;
    private final UserRepository userRepository;
    private final UserPeladaMembershipRepository userPeladaMembershipRepository;
    private final PeladaDailyDebitRepository peladaDailyDebitRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','SCOUT','FINANCEIRO')")
    public ResponseEntity<List<Long>> listPresent(
            @PathVariable Long peladaId,
            @RequestParam LocalDate date,
            Authentication authentication) {
        authorize(authentication, peladaId);
        List<Long> ids = peladaPresenceRepository.findByPelada_IdAndPresenceDate(peladaId, date).stream()
                .filter(PeladaPresence::isPresent)
                .map(p -> p.getUser().getId())
                .toList();
        return ResponseEntity.ok(ids);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','SCOUT')")
    @Transactional
    public ResponseEntity<Void> save(
            @PathVariable Long peladaId,
            @Valid @RequestBody PresenceSaveRequest body,
            Authentication authentication) {
        authorize(authentication, peladaId);
        Pelada pelada = peladaRepository
                .findById(peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
        int dailyFee = pelada.getDailyFeeCents() != null && pelada.getDailyFeeCents() > 0 ? pelada.getDailyFeeCents() : 1000;
        peladaPresenceRepository.deleteByPeladaIdAndPresenceDate(peladaId, body.getDate());
        List<Long> distinctUserIds = body.getPresentUserIds().stream().distinct().toList();
        Set<Long> diaristaPresentIds = new HashSet<>();
        for (Long uid : distinctUserIds) {
            UserPeladaMembership mem = userPeladaMembershipRepository
                    .findById(new UserPeladaId(uid, peladaId))
                    .orElseThrow(() -> new IllegalArgumentException("Usuário não é membro desta pelada: " + uid));
            if (mem == null) {
                throw new IllegalArgumentException("Usuário não é membro desta pelada: " + uid);
            }
            User u = userRepository
                    .findById(uid)
                    .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado: " + uid));
            peladaPresenceRepository.save(PeladaPresence.builder()
                    .pelada(pelada)
                    .user(u)
                    .presenceDate(body.getDate())
                    .present(true)
                    .build());
            if (!mem.isBillingMonthly()) {
                diaristaPresentIds.add(uid);
                peladaDailyDebitRepository
                        .findByPelada_IdAndUser_IdAndDebitDate(peladaId, uid, body.getDate())
                        .or(() -> java.util.Optional.of(PeladaDailyDebit.builder()
                                .pelada(pelada)
                                .user(u)
                                .debitDate(body.getDate())
                                .amountCents(dailyFee)
                                .build()))
                        .ifPresent(debit -> {
                            if (debit.getId() == null) {
                                peladaDailyDebitRepository.save(debit);
                            }
                        });
            }
        }
        for (PeladaDailyDebit debit : peladaDailyDebitRepository.findByPelada_IdAndDebitDate(peladaId, body.getDate())) {
            if (debit.getPaidAt() == null && !diaristaPresentIds.contains(debit.getUser().getId())) {
                peladaDailyDebitRepository.delete(debit);
            }
        }
        return ResponseEntity.ok().build();
    }

    private static void authorize(Authentication authentication, Long peladaId) {
        AppUserDetails u = (AppUserDetails) authentication.getPrincipal();
        if (u.isAdminGeral()) {
            return;
        }
        if ((u.hasRole(Role.ADMIN) || u.hasRole(Role.SCOUT) || u.hasRole(Role.FINANCEIRO))
                && u.getPeladaId() != null
                && u.getPeladaId().equals(peladaId)) {
            return;
        }
        throw new AccessDeniedException("Sem permissão na pelada.");
    }
}
