package com.varzeastats.dto;

import com.varzeastats.entity.Role;
import java.util.List;
import lombok.Data;

@Data
public class UserUpdateRequest {

    private String name;
    private List<Role> roles;
    private Long peladaId;
    private List<Long> peladaIds;
    private Boolean accountActive;
    private String password;
}
