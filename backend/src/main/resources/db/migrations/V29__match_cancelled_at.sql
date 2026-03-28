ALTER TABLE matches ADD COLUMN cancelled_at TIMESTAMPTZ;

COMMENT ON COLUMN matches.cancelled_at IS 'Preenchido quando a partida foi cancelada (sem resultado de encerramento normal).';
