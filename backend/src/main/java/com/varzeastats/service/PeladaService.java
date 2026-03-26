package com.varzeastats.service;

import com.varzeastats.dto.PeladaCreateRequest;
import com.varzeastats.dto.PeladaPublicCardResponse;
import com.varzeastats.dto.PeladaResponse;
import com.varzeastats.dto.PeladaSettingsRequest;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.entity.UserPeladaId;
import com.varzeastats.entity.UserPeladaMembership;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.UserPeladaMembershipRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.security.AppUserDetails;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.TreeSet;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class PeladaService {

    private static final Pattern HH_MM = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");
    private static final String[] DOW_PT = {"", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"};

    private final PeladaRepository peladaRepository;
    private final PeladaLogoStorageService peladaLogoStorageService;
    private final UserPeladaMembershipRepository userPeladaMembershipRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<PeladaResponse> findAll() {
        return peladaRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PeladaResponse> findAllByIds(List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return peladaRepository.findAllByIdIn(ids).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PeladaResponse> findForPrincipal(AppUserDetails u) {
        if (u.isAdminGeral()) {
            return findAll();
        }
        List<Long> mids = userPeladaMembershipRepository.findById_UserId(u.getUserId()).stream()
                .map(m -> m.getId().getPeladaId())
                .sorted()
                .toList();
        if (!mids.isEmpty()) {
            return findAllByIds(mids);
        }
        if (u.getPeladaId() != null) {
            return List.of(findById(u.getPeladaId()));
        }
        return List.of();
    }

    @Transactional(readOnly = true)
    public List<PeladaPublicCardResponse> findPublicCards() {
        return peladaRepository.findAll().stream()
                .filter(Pelada::isActive)
                .sorted(Comparator.comparing(Pelada::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .map(p -> PeladaPublicCardResponse.builder()
                        .id(p.getId())
                        .name(p.getName())
                        .playerCount(userPeladaMembershipRepository.countByPeladaId(p.getId()))
                        .location(p.getLocation())
                        .scheduleLabel(formatScheduleSummary(p))
                        .createdAt(p.getCreatedAt())
                        .hasLogo(p.getLogoFileName() != null && !p.getLogoFileName().isBlank())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public PeladaResponse findById(Long id) {
        Pelada p = peladaRepository
                .findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada"));
        return toResponse(p);
    }

    @Transactional
    public PeladaResponse create(PeladaCreateRequest request, Authentication authentication) {
        return create(request.getName().trim(), null, authentication);
    }

    @Transactional
    public PeladaResponse create(String name, MultipartFile logoFile, Authentication authentication) {
        AppUserDetails caller = requireCaller(authentication);
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Nome da pelada é obrigatório.");
        }
        if (peladaRepository.existsByNameEqualNormalized(trimmed)) {
            throw new IllegalArgumentException("Já existe uma pelada com este nome.");
        }
        Pelada p = Pelada.builder()
                .name(trimmed)
                .createdAt(Instant.now())
                .active(true)
                .build();
        p = peladaRepository.save(p);
        if (logoFile != null && !logoFile.isEmpty()) {
            String old = p.getLogoFileName();
            if (old != null && !old.isBlank()) {
                peladaLogoStorageService.deleteIfExists(old);
            }
            String stored = peladaLogoStorageService.storeLogo(p.getId(), logoFile);
            p.setLogoFileName(stored);
            p = peladaRepository.save(p);
        }
        bindCreatorIfNeeded(caller, p);
        return toResponse(p);
    }

    private AppUserDetails requireCaller(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AppUserDetails caller)) {
            throw new AccessDeniedException("Acesso negado.");
        }
        if (caller.isAdminGeral()) {
            return caller;
        }
        if (caller.hasRole(Role.ADMIN) && caller.getPeladaId() == null) {
            return caller;
        }
        throw new AccessDeniedException("Sem permissão para criar pelada.");
    }

    private void bindCreatorIfNeeded(AppUserDetails caller, Pelada pelada) {
        if (caller.isAdminGeral()) {
            return;
        }
        User creator = userRepository.findById(caller.getUserId()).orElseThrow();
        if (!creator.getRoles().contains(Role.ADMIN)) {
            throw new AccessDeniedException("Somente ADMIN pode criar a própria pelada.");
        }
        if (creator.getPelada() != null) {
            throw new IllegalArgumentException("Este administrador já está vinculado a uma pelada.");
        }
        creator.setPelada(pelada);
        userRepository.save(creator);
        UserPeladaMembership m = UserPeladaMembership.builder()
                .id(new UserPeladaId(creator.getId(), pelada.getId()))
                .billingMonthly(true)
                .build();
        userPeladaMembershipRepository.save(m);
    }

    @Transactional
    public PeladaResponse updateSettings(Long id, PeladaSettingsRequest request, Authentication authentication) {
        Pelada p = peladaRepository
                .findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
        authorizePeladaManagement(authentication, id);
        if (request.getActive() != null) {
            p.setActive(request.getActive());
        }
        if (request.getLocation() != null) {
            p.setLocation(request.getLocation().isBlank() ? null : request.getLocation().trim());
        }
        if (request.getScheduleTime() != null) {
            String t = request.getScheduleTime().trim();
            if (t.isEmpty()) {
                p.setScheduleTime(null);
            } else if (HH_MM.matcher(t).matches()) {
                p.setScheduleTime(t);
            } else {
                throw new IllegalArgumentException("Horário inválido. Use o formato HH:mm (24 horas).");
            }
        }
        if (request.getMonthlyDueDay() != null) {
            int d = request.getMonthlyDueDay();
            if (d < 1 || d > 31) {
                throw new IllegalArgumentException("Dia de vencimento deve ser entre 1 e 31.");
            }
            p.setMonthlyDueDay(d);
        }
        if (request.getScheduleWeekdays() != null) {
            if (request.getScheduleWeekdays().isEmpty()) {
                p.setScheduleWeekdays(null);
            } else {
                TreeSet<Integer> set = new TreeSet<>();
                for (Integer d : request.getScheduleWeekdays()) {
                    if (d == null || d < 1 || d > 7) {
                        throw new IllegalArgumentException("Dia da semana inválido (use 1=Seg … 7=Dom).");
                    }
                    set.add(d);
                }
                p.setScheduleWeekdays(set.stream().map(String::valueOf).collect(Collectors.joining(",")));
            }
        }
        if (hasStructuredSchedule(p)) {
            p.setScheduleLabel(null);
        }
        if (request.getMonthlyFeeCents() != null) {
            p.setMonthlyFeeCents(request.getMonthlyFeeCents());
        }
        if (request.getDailyFeeCents() != null) {
            p.setDailyFeeCents(request.getDailyFeeCents());
        }
        if (request.getTeamCount() != null) {
            p.setTeamCount(request.getTeamCount());
        }
        if (request.getLinePlayersPerTeam() != null) {
            int lp = request.getLinePlayersPerTeam();
            p.setLinePlayersPerTeam(lp <= 0 ? null : lp);
        }
        if (request.getTeamNames() != null) {
            p.setTeamNames(request.getTeamNames().isBlank() ? null : request.getTeamNames());
        }
        if (request.getMatchDurationMinutes() != null) {
            p.setMatchDurationMinutes(request.getMatchDurationMinutes());
        }
        if (request.getMatchGoalsToEnd() != null) {
            p.setMatchGoalsToEnd(request.getMatchGoalsToEnd());
        }
        p = peladaRepository.save(p);
        return toResponse(p);
    }

    private void authorizePeladaManagement(Authentication authentication, Long peladaId) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AppUserDetails u)) {
            throw new AccessDeniedException("Acesso negado.");
        }
        if (u.isAdminGeral()) {
            return;
        }
        if (u.hasRole(Role.ADMIN)
                && u.getPeladaId() != null
                && u.getPeladaId().equals(peladaId)) {
            return;
        }
        throw new AccessDeniedException("Sem permissão para alterar esta pelada.");
    }

    @Transactional(readOnly = true)
    public Optional<PeladaLogoStorageService.LoadedLogo> getLogo(Long peladaId) {
        return peladaRepository
                .findById(peladaId)
                .filter(p -> p.getLogoFileName() != null && !p.getLogoFileName().isBlank())
                .flatMap(p -> peladaLogoStorageService.load(p.getLogoFileName()));
    }

    private PeladaResponse toResponse(Pelada p) {
        boolean hasLogo = p.getLogoFileName() != null && !p.getLogoFileName().isBlank();
        List<Integer> weekdays = parseWeekdaysCsv(p.getScheduleWeekdays());
        return PeladaResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .createdAt(p.getCreatedAt())
                .hasLogo(hasLogo)
                .active(p.isActive())
                .location(p.getLocation())
                .scheduleLabel(formatScheduleSummary(p))
                .scheduleTime(p.getScheduleTime())
                .monthlyDueDay(p.getMonthlyDueDay())
                .scheduleWeekdays(weekdays.isEmpty() ? null : weekdays)
                .scheduleLegacyLabel(scheduleLegacyForApi(p, weekdays))
                .monthlyFeeCents(p.getMonthlyFeeCents())
                .dailyFeeCents(p.getDailyFeeCents())
                .teamCount(p.getTeamCount())
                .linePlayersPerTeam(p.getLinePlayersPerTeam())
                .teamNames(p.getTeamNames())
                .matchDurationMinutes(p.getMatchDurationMinutes())
                .matchGoalsToEnd(p.getMatchGoalsToEnd())
                .build();
    }

    private static boolean hasStructuredSchedule(Pelada p) {
        return (p.getScheduleWeekdays() != null && !p.getScheduleWeekdays().isBlank())
                || (p.getScheduleTime() != null && !p.getScheduleTime().isBlank());
    }

    private static String scheduleLegacyForApi(Pelada p, List<Integer> parsedWeekdays) {
        if (hasStructuredSchedule(p) || !parsedWeekdays.isEmpty()) {
            return null;
        }
        String leg = p.getScheduleLabel();
        if (leg == null || leg.isBlank()) {
            return null;
        }
        return leg.trim();
    }

    private static List<Integer> parseWeekdaysCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        List<Integer> out = new ArrayList<>();
        for (String part : csv.split(",")) {
            String s = part.trim();
            if (s.isEmpty()) {
                continue;
            }
            try {
                int d = Integer.parseInt(s);
                if (d >= 1 && d <= 7) {
                    out.add(d);
                }
            } catch (NumberFormatException ignored) {
                // skip invalid token
            }
        }
        return out.stream().distinct().sorted().toList();
    }

    private static String formatScheduleSummary(Pelada p) {
        List<Integer> days = parseWeekdaysCsv(p.getScheduleWeekdays());
        String time = p.getScheduleTime();
        boolean hasDays = !days.isEmpty();
        boolean hasTime = time != null && !time.isBlank();
        if (hasDays && hasTime) {
            return formatDaysPt(days) + " · " + time.trim();
        }
        if (hasDays) {
            return formatDaysPt(days);
        }
        if (hasTime) {
            return time.trim();
        }
        if (p.getScheduleLabel() != null && !p.getScheduleLabel().isBlank()) {
            return p.getScheduleLabel().trim();
        }
        return null;
    }

    private static String formatDaysPt(List<Integer> sortedUniqueDays) {
        return sortedUniqueDays.stream().map(d -> DOW_PT[d]).collect(Collectors.joining(", "));
    }
}
