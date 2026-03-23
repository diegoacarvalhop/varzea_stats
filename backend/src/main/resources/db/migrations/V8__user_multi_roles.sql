-- Um usuário pode ter vários perfis (ex.: SCOUT + MEDIA).
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role    VARCHAR(32) NOT NULL,
    PRIMARY KEY (user_id, role)
);

INSERT INTO user_roles (user_id, role)
SELECT id, role FROM users;

ALTER TABLE users DROP COLUMN role;
