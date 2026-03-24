package com.varzeastats.dto;

import jakarta.validation.constraints.NotNull;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.Data;

@Data
public class MembershipUpdateRequest {

    @NotNull
    private List<Long> peladaIds;

    private Map<Long, Boolean> billingMonthlyByPelada = new LinkedHashMap<>();
}
