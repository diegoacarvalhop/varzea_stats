package com.varzeastats.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.Data;

@Data
public class PresenceSaveRequest {

    @NotNull
    private LocalDate date;

    @NotNull
    private List<Long> presentUserIds = new ArrayList<>();
}
