CREATE TABLE match_team_scores (
    id       BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
    team_id  BIGINT NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    goals    INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_match_team_scores_match_team UNIQUE (match_id, team_id)
);

CREATE INDEX idx_match_team_scores_match_id ON match_team_scores (match_id);
