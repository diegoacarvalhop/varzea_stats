package com.varzeastats.controller;

import com.varzeastats.dto.UserCreateRequest;
import com.varzeastats.dto.UserResponse;
import com.varzeastats.dto.UserUpdateRequest;
import com.varzeastats.service.UserService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN','FINANCEIRO')")
    public ResponseEntity<List<UserResponse>> list(Authentication authentication) {
        return ResponseEntity.ok(userService.listForPrincipal(authentication));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN')")
    public ResponseEntity<UserResponse> create(
            @Valid @RequestBody UserCreateRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.create(request, authentication));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN_GERAL','ADMIN')")
    public ResponseEntity<UserResponse> patch(
            @PathVariable Long id,
            @RequestBody UserUpdateRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(userService.updateUser(id, request, authentication));
    }
}
