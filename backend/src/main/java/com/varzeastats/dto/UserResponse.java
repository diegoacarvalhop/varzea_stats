package com.varzeastats.dto;

import com.varzeastats.entity.Role;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {

    private Long id;
    private String name;
    private String email;
    private List<Role> roles;
    private Long peladaId;
    private String peladaName;

    private Boolean accountActive;

    private java.util.List<Long> peladaIds;
}
