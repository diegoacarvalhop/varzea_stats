package com.varzeastats.controller;

import com.varzeastats.dto.PlayerDirectoryEntryResponse;
import com.varzeastats.security.PeladaResolver;
import com.varzeastats.service.PlayerService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/players")
@RequiredArgsConstructor
public class PlayersController {

    private final PlayerService playerService;

    @GetMapping
    public ResponseEntity<List<PlayerDirectoryEntryResponse>> listDirectory(
            @RequestAttribute(PeladaResolver.REQUEST_ATTR_PELADA_ID) long peladaId) {
        return ResponseEntity.ok(playerService.findAllDirectory(peladaId));
    }
}
