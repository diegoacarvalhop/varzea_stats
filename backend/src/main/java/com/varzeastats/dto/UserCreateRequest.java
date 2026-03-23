package com.varzeastats.dto;

import com.varzeastats.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import lombok.Data;

@Data
public class UserCreateRequest {

    @NotBlank
    private String name;

    @NotBlank
    @Email
    private String email;

    @NotEmpty(message = "Informe pelo menos um perfil.")
    private List<Role> roles;

    /**
     * Obrigatório exceto quando o único perfil é ADMIN_GERAL. Combinar ADMIN_GERAL com outros perfis não é permitido.
     */
    private Long peladaId;
}
