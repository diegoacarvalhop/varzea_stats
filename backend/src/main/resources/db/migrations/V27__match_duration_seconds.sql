-- Duração da partida com precisão de segundos (HH:MM:SS na UI).
ALTER TABLE peladas ADD COLUMN IF NOT EXISTS match_duration_seconds INTEGER;

UPDATE peladas
SET match_duration_seconds = match_duration_minutes * 60
WHERE match_duration_minutes IS NOT NULL
  AND match_duration_seconds IS NULL;

ALTER TABLE peladas DROP COLUMN IF EXISTS match_duration_minutes;
