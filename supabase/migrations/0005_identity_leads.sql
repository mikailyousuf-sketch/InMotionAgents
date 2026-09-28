alter table public.conversations
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.customers
  add column if not exists source text,
  add column if not exists first_contacted_at timestamptz default now();

create index if not exists customers_business_phone_idx
  on public.customers (business_id, phone);

create index if not exists customers_business_email_idx
  on public.customers (business_id, email);
