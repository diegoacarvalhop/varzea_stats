package com.varzeastats.service;

import com.varzeastats.entity.AuditLog;
import com.varzeastats.entity.Pelada;
import com.varzeastats.entity.User;
import com.varzeastats.repository.AuditLogRepository;
import com.varzeastats.repository.PeladaRepository;
import com.varzeastats.repository.UserRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final PeladaRepository peladaRepository;

    public void record(
            Long actorUserId, String action, String targetType, String targetId, Long peladaId, String detailsJson) {
        AuditLog log = new AuditLog();
        User actor = actorUserId != null ? userRepository.findById(actorUserId).orElse(null) : null;
        Pelada pelada = peladaId != null ? peladaRepository.findById(peladaId).orElse(null) : null;
        log.setActorUser(actor);
        log.setAction(action);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setPelada(pelada);
        log.setDetailsJson(detailsJson);
        log.setCreatedAt(Instant.now());
        auditLogRepository.save(log);
    }
}
