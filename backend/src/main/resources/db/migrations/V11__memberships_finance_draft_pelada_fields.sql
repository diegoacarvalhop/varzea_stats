ALTER TABLE peladas
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS location VARCHAR(300),
    ADD COLUMN IF NOT EXISTS schedule_label VARCHAR(120),
    ADD COLUMN IF NOT EXISTS monthly_fee_cents INTEGER,
    ADD COLUMN IF NOT EXISTS daily_fee_cents INTEGER,
    ADD COLUMN IF NOT EXISTS team_count INTEGER,
    ADD COLUMN IF NOT EXISTS team_names TEXT,
    ADD COLUMN IF NOT EXISTS match_duration_minutes INTEGER,
    ADD COLUMN IF NOT EXISTS match_goals_to_end INTEGER;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS account_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS user_pelada (
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    pelada_id BIGINT NOT NULL REFERENCES peladas (id) ON DELETE CASCADE,
    billing_monthly BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (user_id, pelada_id)
);

CREATE INDEX IF NOT EXISTS idx_user_pelada_pelada ON user_pelada (pelada_id);

INSERT INTO user_pelada (user_id, pelada_id, billing_monthly)
SELECT id, pelada_id, TRUE
FROM users
WHERE pelada_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS pelada_presence (
    id BIGSERIAL PRIMARY KEY,
    pelada_id BIGINT NOT NULL REFERENCES peladas (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    presence_date DATE NOT NULL,
    present BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (pelada_id, user_id, presence_date)
);

CREATE INDEX IF NOT EXISTS idx_presence_pelada_date ON pelada_presence (pelada_id, presence_date);

CREATE TABLE IF NOT EXISTS pelada_payment (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    pelada_id BIGINT NOT NULL REFERENCES peladas (id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL,
    amount_cents INTEGER NOT NULL,
    paid_at DATE NOT NULL,
    reference_month DATE NOT NULL,
    UNIQUE (pelada_id, user_id, kind, reference_month)
);

CREATE INDEX IF NOT EXISTS idx_payment_pelada_user ON pelada_payment (pelada_id, user_id);

CREATE TABLE IF NOT EXISTS pelada_draft_team (
    id BIGSERIAL PRIMARY KEY,
    pelada_id BIGINT NOT NULL REFERENCES peladas (id) ON DELETE CASCADE,
    draft_date DATE NOT NULL,
    team_index INTEGER NOT NULL,
    team_name VARCHAR(200) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    skill_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    UNIQUE (pelada_id, draft_date, team_index, user_id)
);

CREATE INDEX IF NOT EXISTS idx_draft_pelada_date ON pelada_draft_team (pelada_id, draft_date);
