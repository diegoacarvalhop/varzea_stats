package com.varzeastats.security;

import com.varzeastats.entity.Role;
import com.varzeastats.entity.User;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

@Getter
public class AppUserDetails implements UserDetails {

    private final Long userId;
    private final String email;
    private final String password;
    private final Set<Role> roles;
    /** Nulo para conta só ADMIN_GERAL; preenchido quando há perfil vinculado à pelada. */
    private final Long peladaId;

    private final Collection<? extends GrantedAuthority> authorities;

    public AppUserDetails(User user) {
        this.userId = user.getId();
        this.email = user.getEmail();
        this.password = user.getPassword();
        this.roles = user.getRoles() != null ? new LinkedHashSet<>(user.getRoles()) : new LinkedHashSet<>();
        this.peladaId = user.getPelada() != null ? user.getPelada().getId() : null;
        this.authorities = this.roles.stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r.name()))
                .collect(Collectors.toUnmodifiableList());
    }

    public boolean hasRole(Role role) {
        return roles.contains(role);
    }

    public boolean isAdminGeral() {
        return roles.contains(Role.ADMIN_GERAL);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
