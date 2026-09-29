create type public.receptionist_change_status as enum ('proposed','applied','rejected','failed');

create table if not exists public.receptionist_change_proposals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  user_instruction text not null,
  summary text not null,
  changes jsonb not null default '[]'::jsonb,
  status public.receptionist_change_status not null default 'proposed',
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.call_status as enum ('ringing','answered','completed','missed','failed','transferred');
create type public.call_handled_by as enum ('ai','human','mixed');

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  provider text,
  external_call_id text,
  direction text not null default 'inbound',
  from_number text,
  to_number text,
  status public.call_status not null default 'ringing',
  handled_by public.call_handled_by,
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  recording_url text,
  transcript text,
  summary text,
  outcome text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receptionist_change_proposals_business_idx
  on public.receptionist_change_proposals (business_id, created_at desc);

create index if not exists calls_business_started_idx
  on public.calls (business_id, started_at desc);

create unique index if not exists calls_provider_external_idx
  on public.calls (provider, external_call_id)
  where external_call_id is not null;

alter table public.receptionist_change_proposals enable row level security;
alter table public.calls enable row level security;
