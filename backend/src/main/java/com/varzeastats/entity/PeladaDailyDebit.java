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
@Table(name = "pelada_daily_debit")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PeladaDailyDebit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pelada_id")
    private Pelada pelada;

    @Column(name = "debit_date", nullable = false)
    private LocalDate debitDate;

    @Column(name = "amount_cents", nullable = false)
    private int amountCents;

    @Column(name = "paid_at")
    private LocalDate paidAt;
}
