alter table users
    add column if not exists is_goalkeeper boolean not null default false;

