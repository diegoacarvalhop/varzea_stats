package com.varzeastats.service;

import com.varzeastats.dto.DraftPlayerSlotResponse;
import com.varzeastats.dto.DraftRunRequest;
import com.varzeastats.dto.DraftTeamLineResponse;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.PeladaDraftSlot;
import com.varzeastats.entity.PeladaPresence;
import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import com.varzeastats.repository.PeladaDraftSlotRepository;
import com.varzeastats.repository.PeladaPresenceRepository;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.UserRepository;
import com.varzeastats.security.AppUserDetails;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DraftService {

    private final PeladaRepository peladaRepository;
    private final PeladaPresenceRepository peladaPresenceRepository;
    private final PeladaDraftSlotRepository peladaDraftSlotRepository;
    private final UserRepository userRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public List<DraftTeamLineResponse> run(Long peladaId, DraftRunRequest request, AppUserDetails caller) {
        authorize(caller, peladaId);
        LocalDate date = request.getDate();
        List<Long> presentUserIds = peladaPresenceRepository.findByPelada_IdAndPresenceDate(peladaId, date).stream()
                .filter(PeladaPresence::isPresent)
                .map(p -> p.getUser().getId())
                .distinct()
                .toList();
        if (presentUserIds.isEmpty()) {
            throw new IllegalArgumentException("Registre a lista de presença antes de sortear os times.");
        }
        Pelada pelada = peladaRepository
                .findById(peladaId)
                .orElseThrow(() -> new IllegalArgumentException("Pelada não encontrada."));
        List<String> names = resolveTeamNames(request, pelada);
        int teamCount = names.size();
        Map<String, Integer> teamIndexByName = new LinkedHashMap<>();
        for (int i = 0; i < names.size(); i++) {
            teamIndexByName.put(names.get(i), i);
        }
        Map<Long, Double> scores = loadSkillScores(peladaId, presentUserIds);
        Set<Long> presentSet = new HashSet<>(presentUserIds);
        Map<String, Long> goalkeeperByTeamReq = request.getGoalkeeperByTeam() == null
                ? Map.of()
                : request.getGoalkeeperByTeam();
        List<Long> gkRequested =
                request.getGoalkeeperUserIds() == null ? List.of() : request.getGoalkeeperUserIds();
        Set<Long> gkSet = new HashSet<>(gkRequested);
        Map<Integer, Long> assignedGoalkeeperByTeamIndex = new LinkedHashMap<>();
        if (!goalkeeperByTeamReq.isEmpty()) {
            for (Map.Entry<String, Long> e : goalkeeperByTeamReq.entrySet()) {
                String teamName = e.getKey() == null ? "" : e.getKey().trim();
                Long uid = e.getValue();
                if (!teamIndexByName.containsKey(teamName)) {
                    throw new IllegalArgumentException("Equipe inválida no goleiro por time: " + teamName);
                }
                if (uid == null) {
                    throw new IllegalArgumentException("Goleiro inválido para o time: " + teamName);
                }
                if (!presentSet.contains(uid)) {
                    throw new IllegalArgumentException("Todo goleiro deve estar na lista de presença do dia.");
                }
                User gkUser = userRepository.findById(uid).orElseThrow(() -> new IllegalArgumentException("Usuário goleiro não encontrado."));
                if (!gkUser.isGoalkeeper()) {
                    throw new IllegalArgumentException("O usuário selecionado não está marcado como goleiro: " + gkUser.getName());
                }
                int idx = teamIndexByName.get(teamName);
                assignedGoalkeeperByTeamIndex.put(idx, uid);
                gkSet.add(uid);
            }
        }
        for (Long g : gkSet) {
            if (!presentSet.contains(g)) {
                throw new IllegalArgumentException("Todo goleiro deve estar na lista de presença do dia.");
            }
        }
        List<Long> fieldIds = presentUserIds.stream().filter(id -> !gkSet.contains(id)).toList();
        Random rnd = new Random(peladaId * 31L + date.toEpochDay());
        fieldIds = new ArrayList<>(fieldIds);
        fieldIds.sort(Comparator.<Long>comparingDouble(u -> scores.getOrDefault(u, 0d)).reversed());
        fieldIds = shuffleEqualScoreRuns(fieldIds, scores, rnd);
        Integer linePlayersPerTeam = request.getLinePlayersPerTeam();
        if (linePlayersPerTeam != null && linePlayersPerTeam > 0) {
            int maxField = linePlayersPerTeam * teamCount;
            if (fieldIds.size() > maxField) {
                fieldIds = new ArrayList<>(fieldIds.subList(0, maxField));
            }
        }
        List<List<Long>> teams =
                IntStream.range(0, teamCount).mapToObj(i -> new ArrayList<Long>()).collect(Collectors.toList());
        for (Map.Entry<Integer, Long> e : assignedGoalkeeperByTeamIndex.entrySet()) {
            teams.get(e.getKey()).add(e.getValue());
        }
        List<List<Long>> distributedField = snakeBuckets(fieldIds, teamCount);
        for (int i = 0; i < teamCount; i++) {
            teams.get(i).addAll(distributedField.get(i));
        }
        peladaDraftSlotRepository.deleteByPeladaIdAndDraftDate(peladaId, date);
        List<DraftTeamLineResponse> lines = new ArrayList<>();
        for (int t = 0; t < teamCount; t++) {
            List<DraftPlayerSlotResponse> players = new ArrayList<>();
            for (Long uid : teams.get(t)) {
                User u = userRepository
                        .findById(uid)
                        .orElseThrow(() -> new IllegalStateException("Usuário não encontrado."));
                double sc = scores.getOrDefault(uid, 0d);
                peladaDraftSlotRepository.save(PeladaDraftSlot.builder()
                        .pelada(pelada)
                        .draftDate(date)
                        .teamIndex(t)
                        .teamName(names.get(t))
                        .user(u)
                        .skillScore(sc)
                        .goalkeeper(assignedGoalkeeperByTeamIndex.getOrDefault(t, -1L).equals(uid))
                        .build());
                players.add(DraftPlayerSlotResponse.builder()
                        .userId(u.getId())
                        .userName(u.getName())
                        .skillScore(sc)
                        .goalkeeper(assignedGoalkeeperByTeamIndex.getOrDefault(t, -1L).equals(uid))
                        .build());
            }
            lines.add(DraftTeamLineResponse.builder()
                    .teamIndex(t)
                    .teamName(names.get(t))
                    .players(players)
                    .build());
        }
        return lines;
    }

    @Transactional(readOnly = true)
    public List<DraftTeamLineResponse> lastResult(Long peladaId, LocalDate date, AppUserDetails caller) {
        authorize(caller, peladaId);
        List<PeladaDraftSlot> slots = peladaDraftSlotRepository.findByPelada_IdAndDraftDateOrderByTeamIndexAscIdAsc(
                peladaId, date);
        if (slots.isEmpty()) {
            return List.of();
        }
        Map<Integer, List<PeladaDraftSlot>> byTeam =
                slots.stream().collect(Collectors.groupingBy(PeladaDraftSlot::getTeamIndex));
        List<DraftTeamLineResponse> out = new ArrayList<>();
        for (int t : byTeam.keySet().stream().sorted().toList()) {
            List<PeladaDraftSlot> row = byTeam.get(t);
            String tn = row.get(0).getTeamName();
            List<DraftPlayerSlotResponse> players = row.stream()
                    .sorted(Comparator.comparing(PeladaDraftSlot::isGoalkeeper).reversed())
                    .map(s -> DraftPlayerSlotResponse.builder()
                            .userId(s.getUser().getId())
                            .userName(s.getUser().getName())
                            .skillScore(s.getSkillScore())
                            .goalkeeper(s.isGoalkeeper())
                            .build())
                    .toList();
            out.add(DraftTeamLineResponse.builder()
                    .teamIndex(t)
                    .teamName(tn)
                    .players(players)
                    .build());
        }
        return out;
    }

    private void authorize(AppUserDetails caller, Long peladaId) {
        if (caller.isAdminGeral()) {
            return;
        }
        if (caller.hasRole(Role.ADMIN)
                && caller.getPeladaId() != null
                && caller.getPeladaId().equals(peladaId)) {
            return;
        }
        if (caller.hasRole(Role.SCOUT)
                && caller.getPeladaId() != null
                && caller.getPeladaId().equals(peladaId)) {
            return;
        }
        throw new AccessDeniedException("Sem permissão para sortear times nesta pelada.");
    }

    private static List<String> parseTeamNames(String raw, int teamCount) {
        List<String> names = new ArrayList<>();
        if (raw != null && !raw.isBlank()) {
            for (String p : raw.split("[\\n,;]+")) {
                String t = p.trim();
                if (!t.isEmpty()) {
                    names.add(t);
                }
            }
        }
        while (names.size() < teamCount) {
            names.add("Equipe " + (names.size() + 1));
        }
        return names.subList(0, teamCount);
    }

    private static List<String> resolveTeamNames(DraftRunRequest request, Pelada pelada) {
        List<String> reqNames = request.getTeamNames() == null ? List.of() : request.getTeamNames();
        List<String> cleanedReq = reqNames.stream()
                .map(s -> s == null ? "" : s.trim())
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();
        if (cleanedReq.size() >= 2) {
            return cleanedReq;
        }
        Integer configuredTeamCount = pelada.getTeamCount();
        if (configuredTeamCount == null || configuredTeamCount < 2) {
            throw new IllegalArgumentException("Configure a quantidade de equipes (mínimo 2) nas definições da pelada.");
        }
        return parseTeamNames(pelada.getTeamNames(), configuredTeamCount);
    }

    @SuppressWarnings("unchecked")
    private Map<Long, Double> loadSkillScores(Long peladaId, List<Long> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        String sql =
                """
                SELECT u.id AS uid,
                  COALESCE(SUM(CASE WHEN e.type = 'GOAL' AND e.player_id = pl.id THEN 1 ELSE 0 END), 0)
                  + COALESCE(SUM(CASE WHEN e.type = 'ASSIST' AND e.player_id = pl.id THEN 0.5 ELSE 0 END), 0) AS sc
                FROM users u
                JOIN user_pelada up ON up.user_id = u.id AND up.pelada_id = :peladaId
                JOIN matches m ON m.pelada_id = :peladaId
                JOIN teams tm ON tm.match_id = m.id
                JOIN players pl ON pl.team_id = tm.id AND lower(trim(pl.name)) = lower(trim(u.name))
                LEFT JOIN events e ON e.match_id = m.id AND e.player_id = pl.id
                WHERE u.id IN (:uids)
                GROUP BY u.id
                """;
        Query q = entityManager.createNativeQuery(sql);
        q.setParameter("peladaId", peladaId);
        q.setParameter("uids", userIds);
        Map<Long, Double> map = new HashMap<>();
        for (Object row : (List<Object>) q.getResultList()) {
            Object[] arr = (Object[]) row;
            map.put(((Number) arr[0]).longValue(), ((Number) arr[1]).doubleValue());
        }
        for (Long uid : userIds) {
            map.putIfAbsent(uid, 0d);
        }
        return map;
    }

    /** Desempate entre jogadores com a mesma nota: embaralhamento determinístico (RNG com seed fixa). */
    private static List<Long> shuffleEqualScoreRuns(List<Long> ids, Map<Long, Double> scores, Random rnd) {
        List<Long> result = new ArrayList<>(ids.size());
        int i = 0;
        while (i < ids.size()) {
            int j = i + 1;
            double s = scores.getOrDefault(ids.get(i), 0d);
            while (j < ids.size() && Double.compare(scores.getOrDefault(ids.get(j), 0d), s) == 0) {
                j++;
            }
            List<Long> run = new ArrayList<>(ids.subList(i, j));
            Collections.shuffle(run, rnd);
            result.addAll(run);
            i = j;
        }
        return result;
    }

    private static List<List<Long>> snakeBuckets(List<Long> orderedPlayers, int teamCount) {
        List<List<Long>> teams =
                IntStream.range(0, teamCount).mapToObj(i -> new ArrayList<Long>()).collect(Collectors.toList());
        for (int i = 0; i < orderedPlayers.size(); i++) {
            int round = i / teamCount;
            int slot = i % teamCount;
            int teamIdx = (round % 2 == 0) ? slot : (teamCount - 1 - slot);
            teams.get(teamIdx).add(orderedPlayers.get(i));
        }
        return teams;
    }
}
