create type public.lead_status as enum ('new','warm','qualified','converted','lost');
create type public.conversation_status as enum ('ai','human','closed');

alter table public.customers
  add column if not exists lead_status public.lead_status not null default 'new',
  add column if not exists last_contacted_at timestamptz,
  add column if not exists notes text;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null default 'internal',
  external_thread_id text,
  status public.conversation_status not null default 'ai',
  assigned_user_id uuid,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  direction text not null check (direction in ('inbound','outbound')),
  sender_type text not null check (sender_type in ('customer','ai','human','system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversations_business_updated_idx
  on public.conversations (business_id, updated_at desc);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

create index if not exists customers_business_lead_idx
  on public.customers (business_id, lead_status);

create table if not exists public.handover_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  action text not null check (action in ('requested','accepted','returned_to_ai','closed')),
  reason text,
  created_at timestamptz not null default now()
);
