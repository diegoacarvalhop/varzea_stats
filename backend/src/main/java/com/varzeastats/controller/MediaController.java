package com.varzeastats.controller;

import com.varzeastats.dto.MediaResponse;
import com.varzeastats.dto.MediaUploadRequest;
import com.varzeastats.security.PeladaResolver;
import com.varzeastats.service.MediaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/media")
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;

    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','MEDIA')")
    public ResponseEntity<MediaResponse> upload(
            @Valid @RequestBody MediaUploadRequest request,
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(mediaService.upload(request, peladaId));
    }
}
