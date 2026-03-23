package com.varzeastats.dto;

import com.varzeastats.entity.MediaAssetType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MediaUploadRequest {

    @NotBlank
    private String url;

    @NotNull
    private MediaAssetType type;

    @NotNull
    private Long matchId;
}
