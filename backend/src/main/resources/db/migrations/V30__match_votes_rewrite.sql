-- Votação bola cheia / murcha: novo modelo com partida explícita (um voto por tipo por eleitor por partida).

DROP TABLE IF EXISTS votes CASCADE;

CREATE TABLE match_votes (
    id         BIGSERIAL PRIMARY KEY,
    match_id   BIGINT NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
    voter_id   BIGINT NOT NULL REFERENCES users (id),
    player_id  BIGINT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    kind       VARCHAR(32) NOT NULL CHECK (kind IN ('BOLA_CHEIA', 'BOLA_MURCHA')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_match_votes_voter_match_kind UNIQUE (voter_id, match_id, kind)
);

CREATE INDEX idx_match_votes_match_id ON match_votes (match_id);
CREATE INDEX idx_match_votes_player_id ON match_votes (player_id);
CREATE INDEX idx_match_votes_voter_id ON match_votes (voter_id);
