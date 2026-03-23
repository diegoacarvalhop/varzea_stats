package com.varzeastats.dto;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PeladaResponse {

    private Long id;
    private String name;
    private Instant createdAt;
    /** Indica se existe imagem em GET /peladas/{id}/logo */
    private boolean hasLogo;
}
