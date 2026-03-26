-- Impede duas peladas com o mesmo nome (após trim; comparação sem diferenciar maiúsculas/minúsculas).
-- Se a migração falhar, há nomes duplicados no banco; ajuste manualmente antes de reaplicar.
CREATE UNIQUE INDEX idx_peladas_unique_name_normalized ON peladas (lower(trim(name)));
