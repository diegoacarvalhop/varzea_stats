package com.varzeastats.service;

import com.varzeastats.dto.FinanceDelinquentRowResponse;
import com.varzeastats.dto.FinanceDelinquentReminderRequest;
import com.varzeastats.dto.FinanceMonthlyPaymentResponse;
import com.varzeastats.dto.FinanceReceiptResponse;
import com.varzeastats.entity.PaymentReceiptStatus;
import com.varzeastats.dto.PaymentRecordRequest;
import com.varzeastats.entity.PaymentKind;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.PeladaDailyDebit;
import com.varzeastats.entity.PeladaDelinquentReminder;
import com.varzeastats.entity.PeladaPayment;
import com.varzeastats.entity.PeladaPaymentReceipt;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.entity.UserPeladaId;
import com.varzeastats.entity.UserPeladaMembership;
import com.varzeastats.repository.PeladaPaymentRepository;
import com.varzeastats.repository.PeladaPaymentReceiptRepository;
import com.varzeastats.repository.PeladaDailyDebitRepository;
import com.varzeastats.repository.PeladaDelinquentReminderRepository;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.UserPeladaMembershipRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.security.AppUserDetails;
import java.time.LocalDate;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class FinanceService {

    /** Mensalidade/diária de pelada só se aplica a quem tem perfil de jogador. */
    private static boolean participatesInPlayerBilling(User user) {
        return user != null && user.getRoles() != null && user.getRoles().contains(Role.PLAYER);
    }

    private final PeladaPaymentRepository peladaPaymentRepository;
    private final PeladaDailyDebitRepository peladaDailyDebitRepository;
    private final PeladaDelinquentReminderRepository peladaDelinquentReminderRepository;
    private final UserPeladaMembershipRepository userPeladaMembershipRepository;
    private final UserRepository userRepository;
    private final PeladaRepository peladaRepository;
    private final EmailService emailService;
    private final PeladaPaymentReceiptRepository peladaPaymentReceiptRepository;
    private final PaymentReceiptStorageService paymentReceiptStorageService;
    private final AuditLogService auditLogService;

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
        auditLogService.record(
                caller.getUserId(),
                "FINANCE_RECORD_PAYMENT",
                "PELADA_PAYMENT",
                pay.getId() != null ? String.valueOf(pay.getId()) : null,
                pelada.getId(),
                "{\"userId\":" + user.getId() + ",\"kind\":\"" + request.getKind().name() + "\",\"referenceMonth\":\"" + ref + "\"}");
        if (request.getKind() == PaymentKind.DAILY) {
            peladaDailyDebitRepository
                    .findByPelada_IdAndUser_IdAndDebitDate(pelada.getId(), user.getId(), request.getPaidAt())
                    .ifPresent(debit -> {
                        debit.setPaidAt(request.getPaidAt());
                        peladaDailyDebitRepository.save(debit);
                    });
        }
    }

    @Transactional(readOnly = true)
    public List<FinanceDelinquentRowResponse> listDelinquents(Long peladaId, LocalDate today, AppUserDetails caller) {
        authorizeForPelada(caller, peladaId);
        LocalDate monthStart = today.withDayOfMonth(1);
        Pelada pelada = peladaRepository
                .findById(peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
        List<UserPeladaMembership> members = userPeladaMembershipRepository.findById_PeladaId(peladaId).stream()
                .filter(UserPeladaMembership::isBillingMonthly)
                .toList();
        List<FinanceDelinquentRowResponse> out = new ArrayList<>();
        for (UserPeladaMembership m : members) {
            Long uid = m.getId().getUserId();
            User u = userRepository.findById(uid).orElse(null);
            if (u == null
                    || !u.isAccountActive()
                    || u.isGoalkeeper()
                    || u.getRoles() == null
                    || !u.getRoles().contains(Role.PLAYER)) {
                continue;
            }
            if (m.isBillingMonthly()) {
                if (today.getDayOfMonth() <= effectiveMonthlyDueDay(pelada, today)) {
                    continue;
                }
                List<LocalDate> overdueMonths = listOverdueMonthsForUser(peladaId, uid, pelada, monthStart);
                if (!overdueMonths.isEmpty()) {
                    Long pendingReceiptId = peladaPaymentReceiptRepository
                            .findFirstByPelada_IdAndUser_IdAndStatusOrderBySubmittedAtDesc(
                                    peladaId, uid, PaymentReceiptStatus.PENDING)
                            .map(PeladaPaymentReceipt::getId)
                            .orElse(null);
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
                            .billingType(PaymentKind.MONTHLY.name())
                            .overdueMonths(overdueMonths.stream().map(LocalDate::toString).toList())
                            .pendingReceiptId(pendingReceiptId)
                            .build());
                }
            } else {
                List<PeladaDailyDebit> pendingDaily = peladaDailyDebitRepository
                        .findByPelada_IdAndUser_IdAndPaidAtIsNullOrderByDebitDateAsc(peladaId, uid);
                if (!pendingDaily.isEmpty()) {
                    out.add(FinanceDelinquentRowResponse.builder()
                            .userId(u.getId())
                            .userName(u.getName())
                            .email(u.getEmail())
                            .peladaId(pelada.getId())
                            .peladaName(pelada.getName())
                            .billingType(PaymentKind.DAILY.name())
                            .overdueDailyDates(pendingDaily.stream()
                                    .map(d -> d.getDebitDate().toString())
                                    .toList())
                            .build());
                }
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<Long> monthlyDelinquentPeladaIdsForUser(Long userId, List<Long> peladaIds, LocalDate today) {
        if (peladaIds == null || peladaIds.isEmpty()) {
            return List.of();
        }
        User user = userRepository.findById(userId).orElse(null);
        if (!participatesInPlayerBilling(user)) {
            return List.of();
        }
        if (user.isGoalkeeper()) {
            return List.of();
        }
        LocalDate monthStart = today.withDayOfMonth(1);
        List<Long> out = new ArrayList<>();
        for (Long pid : peladaIds) {
            Pelada peladaForDue =
                    peladaRepository.findById(pid).orElse(null);
            if (peladaForDue == null) {
                continue;
            }
            Optional<UserPeladaMembership> mem = userPeladaMembershipRepository.findById(
                    new UserPeladaId(userId, pid));
            if (mem.isEmpty() || !mem.get().isBillingMonthly()) {
                if (peladaDailyDebitRepository.existsByPelada_IdAndUser_IdAndPaidAtIsNull(pid, userId)) {
                    out.add(pid);
                }
                continue;
            }
            if (today.getDayOfMonth() <= effectiveMonthlyDueDay(peladaForDue, today)) {
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
        authorizeForMonthlyHistory(caller, peladaId, userId);
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
                        .receiptId(pay.getReceipt() != null ? pay.getReceipt().getId() : null)
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FinanceMonthlyPaymentResponse> listMyMonthlyPayments(Long peladaId, AppUserDetails caller) {
        if (caller.getUserId() == null) {
            throw new AccessDeniedException("Sem usuário autenticado.");
        }
        return listMonthlyPaymentsForUser(peladaId, caller.getUserId(), caller);
    }

    @Transactional
    public FinanceReceiptResponse submitMonthlyReceipt(
            Long peladaId, List<String> referenceMonthsRaw, MultipartFile file, AppUserDetails caller) {
        if (caller.getUserId() == null) {
            throw new AccessDeniedException("Sem usuário autenticado.");
        }
        if (!userPeladaMembershipRepository.existsById_UserIdAndId_PeladaId(caller.getUserId(), peladaId)) {
            throw new AccessDeniedException("Você não participa desta pelada.");
        }
        Pelada pelada = peladaRepository
                .findById(peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
        User user = userRepository
                .findById(caller.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado."));
        Set<LocalDate> months = parseReferenceMonths(referenceMonthsRaw);
        if (months.isEmpty()) {
            throw new IllegalArgumentException("Selecione ao menos um mês de referência.");
        }
        var stored = paymentReceiptStorageService.store(peladaId, file);
        PeladaPaymentReceipt receipt = new PeladaPaymentReceipt();
        receipt.setPelada(pelada);
        receipt.setUser(user);
        receipt.setPaidAt(null);
        receipt.setStatus(PaymentReceiptStatus.PENDING);
        receipt.setOriginalFilename(
                stored.originalFilename() != null && !stored.originalFilename().isBlank()
                        ? stored.originalFilename()
                        : stored.storedName());
        receipt.setStoredFilename(stored.storedName());
        receipt.setContentType(stored.contentType());
        receipt.setFileSizeBytes(stored.sizeBytes());
        receipt.setSubmittedAt(Instant.now());
        receipt.setReferenceMonths(months);
        return toReceiptResponse(peladaPaymentReceiptRepository.save(receipt));
    }

    @Transactional(readOnly = true)
    public List<FinanceReceiptResponse> listPendingReceipts(Long peladaId, AppUserDetails caller) {
        authorizeForPelada(caller, peladaId);
        return peladaPaymentReceiptRepository.findByPelada_IdAndStatusOrderBySubmittedAtDesc(peladaId, PaymentReceiptStatus.PENDING)
                .stream()
                .map(this::toReceiptResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FinanceReceiptResponse> listReceiptsByUser(Long peladaId, Long userId, AppUserDetails caller) {
        authorizeForMonthlyHistory(caller, peladaId, userId);
        return peladaPaymentReceiptRepository.findByPelada_IdAndUser_IdOrderBySubmittedAtDesc(peladaId, userId).stream()
                .map(this::toReceiptResponse)
                .toList();
    }

    @Transactional
    public void approveReceipt(Long receiptId, LocalDate paidAt, String note, AppUserDetails caller) {
        PeladaPaymentReceipt receipt = peladaPaymentReceiptRepository
                .findById(receiptId)
                .orElseThrow(() -> new IllegalArgumentException("Comprovante não encontrado."));
        authorizeForPelada(caller, receipt.getPelada().getId());
        if (receipt.getStatus() != PaymentReceiptStatus.PENDING) {
            throw new IllegalArgumentException("Comprovante já foi analisado.");
        }
        if (paidAt == null) {
            throw new IllegalArgumentException("Informe a data do pagamento para aprovar o comprovante.");
        }
        receipt.setStatus(PaymentReceiptStatus.APPROVED);
        receipt.setPaidAt(paidAt);
        receipt.setReviewedAt(Instant.now());
        receipt.setReviewNote(note);
        User reviewer = userRepository.findById(caller.getUserId()).orElse(null);
        receipt.setReviewedBy(reviewer);
        for (LocalDate ref : receipt.getReferenceMonths()) {
            PeladaPayment pay = peladaPaymentRepository
                    .findByPelada_IdAndUser_IdAndKindAndReferenceMonth(
                            receipt.getPelada().getId(), receipt.getUser().getId(), PaymentKind.MONTHLY, ref)
                    .orElseGet(PeladaPayment::new);
            pay.setPelada(receipt.getPelada());
            pay.setUser(receipt.getUser());
            pay.setKind(PaymentKind.MONTHLY);
            pay.setReferenceMonth(ref);
            pay.setPaidAt(paidAt);
            pay.setAmountCents(receipt.getPelada().getMonthlyFeeCents());
            pay.setReceipt(receipt);
            peladaPaymentRepository.save(pay);
        }
        peladaPaymentReceiptRepository.save(receipt);
        auditLogService.record(
                caller.getUserId(),
                "FINANCE_APPROVE_RECEIPT",
                "PELADA_PAYMENT_RECEIPT",
                String.valueOf(receipt.getId()),
                receipt.getPelada().getId(),
                "{\"paidAt\":\"" + paidAt + "\"}");
    }

    @Transactional
    public void rejectReceipt(Long receiptId, String note, AppUserDetails caller) {
        PeladaPaymentReceipt receipt = peladaPaymentReceiptRepository
                .findById(receiptId)
                .orElseThrow(() -> new IllegalArgumentException("Comprovante não encontrado."));
        authorizeForPelada(caller, receipt.getPelada().getId());
        if (receipt.getStatus() != PaymentReceiptStatus.PENDING) {
            throw new IllegalArgumentException("Comprovante já foi analisado.");
        }
        receipt.setStatus(PaymentReceiptStatus.REJECTED);
        receipt.setReviewedAt(Instant.now());
        receipt.setReviewNote(note);
        User reviewer = userRepository.findById(caller.getUserId()).orElse(null);
        receipt.setReviewedBy(reviewer);
        peladaPaymentReceiptRepository.save(receipt);
        auditLogService.record(
                caller.getUserId(),
                "FINANCE_REJECT_RECEIPT",
                "PELADA_PAYMENT_RECEIPT",
                String.valueOf(receipt.getId()),
                receipt.getPelada().getId(),
                "{\"note\":\"" + (note == null ? "" : note.replace("\"", "'")) + "\"}");
    }

    @Transactional(readOnly = true)
    public PaymentReceiptStorageService.LoadedFile loadReceiptFile(Long receiptId, AppUserDetails caller) {
        PeladaPaymentReceipt receipt = peladaPaymentReceiptRepository
                .findById(receiptId)
                .orElseThrow(() -> new IllegalArgumentException("Comprovante não encontrado."));
        boolean isOwner = caller.getUserId() != null && caller.getUserId().equals(receipt.getUser().getId());
        if (!isOwner) {
            authorizeForPelada(caller, receipt.getPelada().getId());
        }
        return paymentReceiptStorageService
                .load(receipt.getStoredFilename())
                .orElseThrow(() -> new IllegalArgumentException("Arquivo do comprovante não encontrado."));
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
        if (!participatesInPlayerBilling(user)) {
            throw new IllegalArgumentException("Cobrança aplica-se apenas a contas com perfil de jogador.");
        }
        if (user.isGoalkeeper()) {
            throw new IllegalArgumentException("Goleiro é isento de cobrança nesta pelada.");
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
        auditLogService.record(
                caller.getUserId(),
                "FINANCE_SEND_DELINQUENT_REMINDER",
                "PELADA_DELINQUENT_REMINDER",
                reminder.getId() != null ? String.valueOf(reminder.getId()) : null,
                pelada.getId(),
                "{\"userId\":" + user.getId() + ",\"referenceMonth\":\"" + monthStart + "\"}");
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

    private void authorizeForMonthlyHistory(AppUserDetails caller, Long peladaId, Long userId) {
        if (caller.getUserId() != null
                && caller.getUserId().equals(userId)
                && userPeladaMembershipRepository.existsById_UserIdAndId_PeladaId(userId, peladaId)) {
            return;
        }
        authorizeForPelada(caller, peladaId);
    }

    /** Dia efetivo de vencimento no mês (1–lengthOfMonth), nunca ultrapassa o último dia do mês. */
    private static int effectiveMonthlyDueDay(Pelada pelada, LocalDate dateInMonth) {
        int raw = pelada.getMonthlyDueDay() != null ? pelada.getMonthlyDueDay() : 15;
        raw = Math.max(1, Math.min(raw, 31));
        return Math.min(raw, dateInMonth.lengthOfMonth());
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

    private static Set<LocalDate> parseReferenceMonths(List<String> rawMonths) {
        if (rawMonths == null || rawMonths.isEmpty()) {
            return Set.of();
        }
        Set<LocalDate> out = new LinkedHashSet<>();
        for (String month : rawMonths) {
            if (month == null || month.isBlank()) continue;
            String normalized = month.length() >= 7 ? month.substring(0, 7) : month;
            out.add(LocalDate.parse(normalized + "-01"));
        }
        return out.stream().sorted(Comparator.naturalOrder()).collect(LinkedHashSet::new, Set::add, Set::addAll);
    }

    private FinanceReceiptResponse toReceiptResponse(PeladaPaymentReceipt receipt) {
        User reviewer = receipt.getReviewedBy();
        return FinanceReceiptResponse.builder()
                .id(receipt.getId())
                .userId(receipt.getUser().getId())
                .userName(receipt.getUser().getName())
                .peladaId(receipt.getPelada().getId())
                .paidAt(receipt.getPaidAt())
                .referenceMonths(receipt.getReferenceMonths().stream().sorted().toList())
                .status(receipt.getStatus())
                .originalFilename(receipt.getOriginalFilename())
                .contentType(receipt.getContentType())
                .fileSizeBytes(receipt.getFileSizeBytes())
                .submittedAt(receipt.getSubmittedAt())
                .reviewedAt(receipt.getReviewedAt())
                .reviewedByUserId(reviewer != null ? reviewer.getId() : null)
                .reviewedByName(reviewer != null ? reviewer.getName() : null)
                .reviewNote(receipt.getReviewNote())
                .build();
    }
}
