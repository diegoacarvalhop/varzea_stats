package com.varzeastats.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "peladas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Pelada {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    /** Nome do arquivo no diretório configurado (não expor caminho completo). */
    @Column(name = "logo_file_name", length = 255)
    private String logoFileName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(length = 300)
    private String location;

    @Column(name = "schedule_label", length = 120)
    private String scheduleLabel;

    /** Horário fixo no formato HH:mm (24h). */
    @Column(name = "schedule_time", length = 5)
    private String scheduleTime;

    /** Dias ISO-8601 (1=Seg … 7=Dom), CSV ordenado, ex.: "1,3,5". */
    @Column(name = "schedule_weekdays", length = 32)
    private String scheduleWeekdays;

    @Column(name = "monthly_fee_cents")
    private Integer monthlyFeeCents;

    @Column(name = "daily_fee_cents")
    private Integer dailyFeeCents;

    @Column(name = "team_count")
    private Integer teamCount;

    @Column(name = "team_names", columnDefinition = "TEXT")
    private String teamNames;

    @Column(name = "match_duration_minutes")
    private Integer matchDurationMinutes;

    @Column(name = "match_goals_to_end")
    private Integer matchGoalsToEnd;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
