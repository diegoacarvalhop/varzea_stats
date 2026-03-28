-- Tempo decorrido no cronômetro (crescente) no momento do lance, em segundos.
ALTER TABLE events
    ADD COLUMN IF NOT EXISTS clock_elapsed_seconds INTEGER NULL;

COMMENT ON COLUMN events.clock_elapsed_seconds IS 'Segundos decorridos desde o início do período do cronômetro ao registrar o lance; NULL = não informado (dados antigos).';
