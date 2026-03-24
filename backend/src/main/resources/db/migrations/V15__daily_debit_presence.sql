CREATE TABLE IF NOT EXISTS pelada_daily_debit (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    pelada_id BIGINT NOT NULL REFERENCES peladas (id) ON DELETE CASCADE,
    debit_date DATE NOT NULL,
    amount_cents INTEGER NOT NULL,
    paid_at DATE NULL,
    UNIQUE (pelada_id, user_id, debit_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_debit_pelada_user_paid
    ON pelada_daily_debit (pelada_id, user_id, paid_at);

CREATE INDEX IF NOT EXISTS idx_daily_debit_pelada_date
    ON pelada_daily_debit (pelada_id, debit_date);
