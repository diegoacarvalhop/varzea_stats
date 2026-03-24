package com.varzeastats.service;

import com.varzeastats.dto.FinanceDelinquentRowResponse;
import com.varzeastats.dto.FinanceDelinquentReminderRequest;
import com.varzeastats.dto.FinanceMonthlyPaymentResponse;
import com.varzeastats.dto.PaymentRecordRequest;
import com.varzeastats.entity.PaymentKind;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.PeladaDelinquentReminder;
import com.varzeastats.entity.PeladaPayment;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.entity.UserPeladaId;
import com.varzeastats.entity.UserPeladaMembership;
import com.varzeastats.repository.PeladaPaymentRepository;
import com.varzeastats.repository.PeladaDelinquentReminderRepository;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.UserPeladaMembershipRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.security.AppUserDetails;
import java.time.LocalDate;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FinanceService {

    private final PeladaPaymentRepository peladaPaymentRepository;
    private final PeladaDelinquentReminderRepository peladaDelinquentReminderRepository;
    private final UserPeladaMembershipRepository userPeladaMembershipRepository;
    private final UserRepository userRepository;
    private final PeladaRepository peladaRepository;
    private final EmailService emailService;

    @Transactional
    public void recordPayment(PaymentRecordRequest request, AppUserDetails caller) {
        authorizeForPelada(caller, request.getPeladaId());
        User user = userRepository
                .findById(request.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));
        Pelada pelada = peladaRepository
                .findById(request.getPeladaId())
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
        if (!userPeladaMembershipRepository.existsById_UserIdAndId_PeladaId(user.getId(), pelada.getId())) {
            throw new IllegalArgumentException("O usuário não participa desta pelada.");
        }
        LocalDate ref = request.getReferenceMonth().withDayOfMonth(1);
        Optional<PeladaPayment> existing = peladaPaymentRepository.findByPelada_IdAndUser_IdAndKindAndReferenceMonth(
                pelada.getId(), user.getId(), request.getKind(), ref);
        PeladaPayment pay = existing.orElseGet(PeladaPayment::new);
        pay.setUser(user);
        pay.setPelada(pelada);
        pay.setKind(request.getKind());
        pay.setAmountCents(request.getAmountCents());
        pay.setPaidAt(request.getPaidAt());
        pay.setReferenceMonth(ref);
        peladaPaymentRepository.save(pay);
    }

    @Transactional(readOnly = true)
    public List<FinanceDelinquentRowResponse> listDelinquents(Long peladaId, LocalDate today, AppUserDetails caller) {
        authorizeForPelada(caller, peladaId);
        LocalDate monthStart = today.withDayOfMonth(1);
        if (today.getDayOfMonth() <= 15) {
            return List.of();
        }
        Pelada pelada = peladaRepository
                .findById(peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
        List<UserPeladaMembership> members = userPeladaMembershipRepository.findById_PeladaId(peladaId).stream()
                .filter(UserPeladaMembership::isBillingMonthly)
                .toList();
        List<FinanceDelinquentRowResponse> out = new ArrayList<>();
        for (UserPeladaMembership m : members) {
            Long uid = m.getId().getUserId();
            List<LocalDate> overdueMonths = listOverdueMonthsForUser(peladaId, uid, pelada, monthStart);
            if (!overdueMonths.isEmpty()) {
                User u = userRepository.findById(uid).orElse(null);
                if (u != null
                        && u.isAccountActive()
                        && u.getRoles() != null
                        && u.getRoles().contains(Role.PLAYER)) {
                    out.add(FinanceDelinquentRowResponse.builder()
                            .userId(u.getId())
                            .userName(u.getName())
                            .email(u.getEmail())
                            .peladaId(pelada.getId())
                            .peladaName(pelada.getName())
                            .reminderSentAt(peladaDelinquentReminderRepository
                                    .findByPelada_IdAndUser_IdAndReferenceMonth(peladaId, uid, monthStart)
                                    .map(PeladaDelinquentReminder::getSentAt)
                                    .orElse(null))
                            .overdueMonths(overdueMonths.stream().map(LocalDate::toString).toList())
                            .build());
                }
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<Long> monthlyDelinquentPeladaIdsForUser(Long userId, List<Long> peladaIds, LocalDate today) {
        if (today.getDayOfMonth() <= 15 || peladaIds == null || peladaIds.isEmpty()) {
            return List.of();
        }
        LocalDate monthStart = today.withDayOfMonth(1);
        List<Long> out = new ArrayList<>();
        for (Long pid : peladaIds) {
            Optional<UserPeladaMembership> mem = userPeladaMembershipRepository.findById(
                    new UserPeladaId(userId, pid));
            if (mem.isEmpty() || !mem.get().isBillingMonthly()) {
                continue;
            }
            boolean paidThisMonth =
                    peladaPaymentRepository.hasMonthlyPaymentForMonth(pid, userId, PaymentKind.MONTHLY, monthStart);
            if (!paidThisMonth) {
                out.add(pid);
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<FinanceMonthlyPaymentResponse> listMonthlyPaymentsForUser(
            Long peladaId, Long userId, AppUserDetails caller) {
        authorizeForPelada(caller, peladaId);
        User user = userRepository
                .findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));
        if (!userPeladaMembershipRepository.existsById_UserIdAndId_PeladaId(userId, peladaId)) {
            throw new IllegalArgumentException("O usuário não participa desta pelada.");
        }
        Pelada pelada = peladaRepository
                .findById(peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
        return peladaPaymentRepository
                .findByPelada_IdAndUser_IdAndKindOrderByReferenceMonthDescPaidAtDescIdDesc(
                        peladaId, userId, PaymentKind.MONTHLY)
                .stream()
                .map(pay -> FinanceMonthlyPaymentResponse.builder()
                        .id(pay.getId())
                        .userId(user.getId())
                        .userName(user.getName())
                        .userEmail(user.getEmail())
                        .peladaId(peladaId)
                        .peladaName(pelada.getName())
                        .amountCents(pay.getAmountCents())
                        .paidAt(pay.getPaidAt())
                        .referenceMonth(pay.getReferenceMonth())
                        .build())
                .toList();
    }

    @Transactional
    public void sendDelinquentReminder(FinanceDelinquentReminderRequest request, AppUserDetails caller) {
        authorizeForPelada(caller, request.getPeladaId());
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);

        Pelada pelada = peladaRepository
                .findById(request.getPeladaId())
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
        User user = userRepository
                .findById(request.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));

        UserPeladaId memId = new UserPeladaId(user.getId(), pelada.getId());
        UserPeladaMembership membership = userPeladaMembershipRepository
                .findById(memId)
                .orElseThrow(() -> new IllegalArgumentException("O usuário não participa desta pelada."));
        if (!membership.isBillingMonthly()) {
            throw new IllegalArgumentException("Cobrança por e-mail disponível apenas para mensalistas.");
        }
        boolean paid =
                peladaPaymentRepository.hasMonthlyPaymentForMonth(pelada.getId(), user.getId(), PaymentKind.MONTHLY, monthStart);
        if (paid) {
            throw new IllegalArgumentException("Este jogador não está inadimplente no mês atual.");
        }

        emailService.enviarEmailCobrancaMensalidade(
                user.getEmail(), user.getName(), pelada.getName(), monthStart, pelada.getMonthlyFeeCents());

        PeladaDelinquentReminder reminder = peladaDelinquentReminderRepository
                .findByPelada_IdAndUser_IdAndReferenceMonth(pelada.getId(), user.getId(), monthStart)
                .orElseGet(PeladaDelinquentReminder::new);
        reminder.setPelada(pelada);
        reminder.setUser(user);
        reminder.setReferenceMonth(monthStart);
        reminder.setSentAt(Instant.now());
        peladaDelinquentReminderRepository.save(reminder);
    }

    private void authorizeForPelada(AppUserDetails caller, Long peladaId) {
        if (caller.isAdminGeral()) {
            return;
        }
        if (caller.hasRole(Role.ADMIN)
                && caller.getPeladaId() != null
                && caller.getPeladaId().equals(peladaId)) {
            return;
        }
        if (caller.hasRole(Role.FINANCEIRO)
                && userPeladaMembershipRepository.existsById_UserIdAndId_PeladaId(caller.getUserId(), peladaId)) {
            return;
        }
        throw new AccessDeniedException("Sem permissão financeira nesta pelada.");
    }

    private List<LocalDate> listOverdueMonthsForUser(Long peladaId, Long userId, Pelada pelada, LocalDate monthStart) {
        LocalDate start = pelada.getCreatedAt() != null
                ? LocalDate.ofInstant(pelada.getCreatedAt(), ZoneId.systemDefault()).withDayOfMonth(1)
                : monthStart;
        if (start.isAfter(monthStart)) {
            return List.of();
        }
        List<LocalDate> out = new ArrayList<>();
        LocalDate cursor = start;
        while (!cursor.isAfter(monthStart)) {
            boolean paid =
                    peladaPaymentRepository.hasMonthlyPaymentForMonth(peladaId, userId, PaymentKind.MONTHLY, cursor);
            if (!paid) {
                out.add(cursor);
            }
            cursor = cursor.plusMonths(1);
        }
        return out;
    }
}
