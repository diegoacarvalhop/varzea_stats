-- VARzea Stats: esquema inicial (domínio partidas, jogadores, eventos, mídia, votos, usuários)
-- Convenção Flyway: V{versão}__{descrição}.sql (dois sublinhados após o número)

CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(255) NOT NULL
);

CREATE TABLE teams (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE matches (
    id       BIGSERIAL PRIMARY KEY,
    date     TIMESTAMPTZ NOT NULL,
    location VARCHAR(255) NOT NULL
);

CREATE TABLE players (
    id      BIGSERIAL PRIMARY KEY,
    name    VARCHAR(255) NOT NULL,
    team_id BIGINT REFERENCES teams (id)
);

CREATE TABLE events (
    id         BIGSERIAL PRIMARY KEY,
    type       VARCHAR(255) NOT NULL,
    player_id  BIGINT REFERENCES players (id),
    target_id  BIGINT REFERENCES players (id),
    match_id   BIGINT NOT NULL REFERENCES matches (id)
);

CREATE TABLE media (
    id       BIGSERIAL PRIMARY KEY,
    url      VARCHAR(2048) NOT NULL,
    type     VARCHAR(255) NOT NULL,
    match_id BIGINT NOT NULL REFERENCES matches (id)
);

CREATE TABLE votes (
    id        BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players (id),
    type      VARCHAR(255) NOT NULL
);

CREATE INDEX idx_players_team_id ON players (team_id);
CREATE INDEX idx_events_match_id ON events (match_id);
CREATE INDEX idx_events_player_id ON events (player_id);
CREATE INDEX idx_media_match_id ON media (match_id);
CREATE INDEX idx_votes_player_id ON votes (player_id);
