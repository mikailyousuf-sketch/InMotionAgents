alter table public.messages
  add column if not exists external_message_id text;

create unique index if not exists messages_external_message_id_unique
  on public.messages (external_message_id)
  where external_message_id is not null;

create table if not exists public.message_delivery_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  external_message_id text not null,
  provider text not null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists message_delivery_events_external_idx
  on public.message_delivery_events (external_message_id, created_at desc);
