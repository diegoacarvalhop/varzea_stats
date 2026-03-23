-- Peladas (grupos isolados). Partidas e usuários não-admin ficam vinculados a uma pelada.
-- Não há pelada criada automaticamente: o administrador geral cadastra peladas pela aplicação.

CREATE TABLE peladas (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
    ADD COLUMN pelada_id BIGINT REFERENCES peladas (id);

ALTER TABLE matches
    ADD COLUMN pelada_id BIGINT REFERENCES peladas (id);

-- Instalação nova: não existem partidas ainda; partidas criadas depois já exigem pelada na API.
ALTER TABLE matches
    ALTER COLUMN pelada_id SET NOT NULL;

CREATE INDEX idx_matches_pelada_id ON matches (pelada_id);
CREATE INDEX idx_users_pelada_id ON users (pelada_id);
