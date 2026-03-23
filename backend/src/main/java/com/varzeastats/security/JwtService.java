package com.varzeastats.security;

import com.varzeastats.entity.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-ms}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(sha256(secret));
        this.expirationMs = expirationMs;
    }

    private static byte[] sha256(String secret) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public String generateToken(String email, Set<Role> roles, Long peladaId, boolean mustChangePassword) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expirationMs);
        List<String> roleNames =
                roles.stream().map(Enum::name).sorted().collect(Collectors.toList());
        var b = Jwts.builder()
                .subject(email)
                .claim("roles", roleNames)
                .claim("mustChangePassword", mustChangePassword)
                .issuedAt(now)
                .expiration(exp);
        if (peladaId != null) {
            b.claim("peladaId", peladaId);
        }
        return b.signWith(key).compact();
    }

    /** Tokens antigos sem o claim tratam como false. */
    public boolean extractMustChangePassword(String token) {
        Object v = parseClaims(token).get("mustChangePassword");
        if (v instanceof Boolean b) {
            return b;
        }
        return false;
    }

    public String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    @SuppressWarnings("unchecked")
    public List<String> extractRoleNames(String token) {
        Object raw = parseClaims(token).get("roles");
        if (raw instanceof List<?> list) {
            return list.stream().map(Object::toString).collect(Collectors.toList());
        }
        // Tokens antigos (claim único "role")
        String legacy = parseClaims(token).get("role", String.class);
        if (legacy != null) {
            return List.of(legacy);
        }
        return List.of();
    }

    public Long extractPeladaId(String token) {
        Object v = parseClaims(token).get("peladaId");
        if (v instanceof Integer i) {
            return i.longValue();
        }
        if (v instanceof Long l) {
            return l;
        }
        return null;
    }

    public boolean isTokenValid(String token, String userEmail) {
        String subject = extractEmail(token);
        return subject != null && subject.equals(userEmail) && !isExpired(token);
    }

    private boolean isExpired(String token) {
        return parseClaims(token).getExpiration().before(new Date());
    }

    private Claims parseClaims(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
