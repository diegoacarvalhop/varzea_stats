create table if not exists pelada_payment_receipt (
    id bigserial primary key,
    user_id bigint not null references users(id),
    pelada_id bigint not null references pelada(id),
    paid_at date not null,
    status varchar(20) not null,
    original_filename varchar(255) not null,
    stored_filename varchar(255) not null,
    content_type varchar(120) not null,
    file_size_bytes bigint not null,
    submitted_at timestamptz not null default now(),
    reviewed_at timestamptz null,
    reviewed_by_user_id bigint null references users(id),
    review_note varchar(500) null
);

create table if not exists pelada_payment_receipt_month (
    receipt_id bigint not null references pelada_payment_receipt(id) on delete cascade,
    reference_month date not null,
    primary key (receipt_id, reference_month)
);

alter table pelada_payment
    add column if not exists receipt_id bigint null references pelada_payment_receipt(id);

create index if not exists idx_payment_receipt_pelada_status
    on pelada_payment_receipt (pelada_id, status, submitted_at desc);

create index if not exists idx_payment_receipt_user_pelada
    on pelada_payment_receipt (user_id, pelada_id, submitted_at desc);
