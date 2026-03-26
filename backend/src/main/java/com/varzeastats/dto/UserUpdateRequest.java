package com.varzeastats.dto;

import com.varzeastats.entity.Role;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.Data;

@Data
public class UserUpdateRequest {

    private String name;
    private List<Role> roles;
    private Long peladaId;
    private List<Long> peladaIds;
    private Boolean accountActive;
    private String password;

    /** Chave = id da pelada; true = mensalista, false = diarista. Só faz efeito em vínculos existentes ou junto com peladaIds. */
    private Map<Long, Boolean> billingMonthlyByPelada = new LinkedHashMap<>();
}
