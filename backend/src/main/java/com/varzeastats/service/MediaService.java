package com.varzeastats.service;

import com.varzeastats.dto.MediaResponse;
import com.varzeastats.dto.MediaUploadRequest;
import com.varzeastats.entity.Match;
import com.varzeastats.entity.Media;
import com.varzeastats.repository.MediaRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MediaService {

    private final MediaRepository mediaRepository;
    private final MatchAccessHelper matchAccessHelper;

    @Transactional(readOnly = true)
    public List<MediaResponse> listByMatch(Long matchId, long peladaId) {
        matchAccessHelper.requireInPelada(matchId, peladaId);
        return mediaRepository.findByMatch_IdOrderByIdDesc(matchId).stream()
                .map(m -> MediaResponse.builder()
                        .id(m.getId())
                        .url(m.getUrl())
                        .type(m.getType())
                        .matchId(matchId)
                        .build())
                .toList();
    }

    @Transactional
    public MediaResponse upload(MediaUploadRequest request, long peladaId) {
        Match match = matchAccessHelper.requireInPelada(request.getMatchId(), peladaId);
        Media media = Media.builder()
                .url(request.getUrl())
                .type(request.getType())
                .match(match)
                .build();
        media = mediaRepository.save(media);
        return MediaResponse.builder()
                .id(media.getId())
                .url(media.getUrl())
                .type(media.getType())
                .matchId(match.getId())
                .build();
    }
}
