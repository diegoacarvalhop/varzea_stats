package com.varzeastats.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "pelada_draft_team")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PeladaDraftSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pelada_id")
    private Pelada pelada;

    @Column(name = "draft_date", nullable = false)
    private LocalDate draftDate;

    @Column(name = "team_index", nullable = false)
    private int teamIndex;

    @Column(name = "team_name", nullable = false, length = 200)
    private String teamName;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "skill_score", nullable = false)
    @Builder.Default
    private double skillScore = 0d;

    @Column(name = "is_goalkeeper", nullable = false)
    @Builder.Default
    private boolean goalkeeper = false;
}
