-- Confronto exibido no placar (dois times da partida), persistido no servidor.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS focus_team_a_id BIGINT REFERENCES teams (id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS focus_team_b_id BIGINT REFERENCES teams (id) ON DELETE SET NULL;
