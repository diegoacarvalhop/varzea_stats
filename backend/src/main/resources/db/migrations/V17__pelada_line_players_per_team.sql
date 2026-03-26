ALTER TABLE peladas
    ADD COLUMN IF NOT EXISTS line_players_per_team INTEGER NULL;

COMMENT ON COLUMN peladas.line_players_per_team IS 'Máx. jogadores de linha por equipe no sorteio (goleiros fora); NULL = sem limite.';
