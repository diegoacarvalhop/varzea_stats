ALTER TABLE votes
    ADD COLUMN voter_id BIGINT REFERENCES users (id);

CREATE UNIQUE INDEX uq_votes_voter_player_type ON votes (voter_id, player_id, type)
    WHERE voter_id IS NOT NULL;
