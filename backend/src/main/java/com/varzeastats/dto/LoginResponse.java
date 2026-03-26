package com.varzeastats.dto;

import com.varzeastats.entity.Role;
import java.util.Map;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {

    private String token;
    private String email;
    private String name;
    private List<Role> roles;
    /** Nulo para conta só ADMIN_GERAL. */
    private Long peladaId;
    private String peladaName;
    /** Dia de vencimento da mensalidade na pelada do contexto (1–31); nulo se sem pelada. */
    private Integer peladaMonthlyDueDay;
    /** Se a pelada da conta tem logomarca (GET /peladas/{id}/logo). */
    private Boolean peladaHasLogo;

    /** True quando o usuário precisa definir nova senha (ex.: senha padrão no primeiro acesso). */
    private boolean mustChangePassword;

    private List<Long> membershipPeladaIds;

    private List<Long> monthlyDelinquentPeladaIds;

    private Map<Long, Boolean> billingMonthlyByPelada;

    private boolean accountActive;

    private boolean goalkeeper;
}
