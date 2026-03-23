-- Equipes passam a pertencer a uma partida (escalação da pelada).

ALTER TABLE teams ADD COLUMN match_id BIGINT REFERENCES matches (id);

DELETE FROM events
WHERE player_id IN (
    SELECT p.id FROM players p
    INNER JOIN teams t ON p.team_id = t.id
    WHERE t.match_id IS NULL
);
DELETE FROM events
WHERE target_id IN (
    SELECT p.id FROM players p
    INNER JOIN teams t ON p.team_id = t.id
    WHERE t.match_id IS NULL
);
DELETE FROM votes
WHERE player_id IN (
    SELECT p.id FROM players p
    INNER JOIN teams t ON p.team_id = t.id
    WHERE t.match_id IS NULL
);
DELETE FROM players WHERE team_id IN (SELECT id FROM teams WHERE match_id IS NULL);
DELETE FROM teams WHERE match_id IS NULL;

ALTER TABLE teams ALTER COLUMN match_id SET NOT NULL;

CREATE INDEX idx_teams_match_id ON teams (match_id);
