-- Identifica o goleiro na escalação da equipe (por jogador).

ALTER TABLE players ADD COLUMN goalkeeper BOOLEAN NOT NULL DEFAULT false;
