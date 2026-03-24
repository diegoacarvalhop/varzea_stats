package com.varzeastats.dto;

import java.time.Instant;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FinanceDelinquentRowResponse {

    private Long userId;
    private String userName;
    private String email;
    private Long peladaId;
    private String peladaName;
    private Instant reminderSentAt;
    private List<String> overdueMonths;
}
