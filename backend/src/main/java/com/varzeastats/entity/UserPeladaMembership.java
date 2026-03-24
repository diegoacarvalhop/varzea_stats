package com.varzeastats.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_pelada")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPeladaMembership {

    @EmbeddedId
    private UserPeladaId id;

    @Column(name = "billing_monthly", nullable = false)
    @Builder.Default
    private boolean billingMonthly = true;
}
