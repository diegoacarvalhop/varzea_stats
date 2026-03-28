ALTER TABLE players
    ADD COLUMN IF NOT EXISTS source_user_id BIGINT REFERENCES users (id);

CREATE INDEX IF NOT EXISTS idx_players_source_user_id ON players (source_user_id);
