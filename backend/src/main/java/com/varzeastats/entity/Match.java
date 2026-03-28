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
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "matches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant date;

    @Column(nullable = false)
    private String location;

    @Column(name = "finished_at")
    private Instant finishedAt;

    /** Quando preenchido, a partida foi cancelada (não conta como encerramento normal). */
    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pelada_id", nullable = false)
    private Pelada pelada;

    /** Time “1” do confronto para placar e telas (opcional). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "focus_team_a_id")
    private Team focusTeamA;

    /** Time “2” do confronto para placar e telas (opcional). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "focus_team_b_id")
    private Team focusTeamB;
}
