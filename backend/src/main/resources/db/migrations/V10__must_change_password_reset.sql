-- Senha obrigatória no primeiro acesso + tokens de recuperação por e-mail
ALTER TABLE users
    ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE password_reset_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token      VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens (user_id);
