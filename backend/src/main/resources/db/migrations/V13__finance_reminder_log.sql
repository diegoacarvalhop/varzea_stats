CREATE TABLE IF NOT EXISTS pelada_delinquent_reminder (
    id BIGSERIAL PRIMARY KEY,
    pelada_id BIGINT NOT NULL REFERENCES peladas (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reference_month DATE NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pelada_id, user_id, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_delinq_reminder_pelada_month
    ON pelada_delinquent_reminder (pelada_id, reference_month);
