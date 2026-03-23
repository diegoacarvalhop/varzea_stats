package com.varzeastats.dto;

import com.varzeastats.entity.MediaAssetType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MediaResponse {

    private Long id;
    private String url;
    private MediaAssetType type;
    private Long matchId;
}
