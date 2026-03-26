ALTER TABLE peladas
    ADD COLUMN IF NOT EXISTS monthly_due_day INTEGER NOT NULL DEFAULT 15;

COMMENT ON COLUMN peladas.monthly_due_day IS 'Dia do mês (1–31) até o qual a mensalidade pode ser paga sem inadimplência no mês corrente; após esse dia, falta pagamento entra na cobrança.';
