alter table pelada_draft_team
    add column if not exists is_goalkeeper boolean not null default false;

