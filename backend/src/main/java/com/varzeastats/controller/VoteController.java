package com.varzeastats.controller;

import com.varzeastats.dto.VoteRequest;
import com.varzeastats.security.AppUserDetails;
import com.varzeastats.security.PeladaResolver;
import com.varzeastats.service.VoteService;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/votes")
@RequiredArgsConstructor
public class VoteController {

    private final VoteService voteService;

    @PostMapping
    public ResponseEntity<Map<String, Long>> vote(
            @Valid @RequestBody VoteRequest request,
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId,
            Authentication authentication) {
        AppUserDetails user = (AppUserDetails) authentication.getPrincipal();
        Long id = voteService.register(request, peladaId, user.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }
}
