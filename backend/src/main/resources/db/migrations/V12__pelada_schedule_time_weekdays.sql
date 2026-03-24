ALTER TABLE peladas
    ADD COLUMN IF NOT EXISTS schedule_time VARCHAR(5),
    ADD COLUMN IF NOT EXISTS schedule_weekdays VARCHAR(32);
