create table if not exists public.agent_guardrails (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  rule_type text not null,
  title text not null,
  instructions text not null,
  action text not null default 'handover',
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists guardrails_business_priority_idx
  on public.agent_guardrails (business_id, active, priority);

create index if not exists agent_events_business_created_idx
  on public.agent_events (business_id, created_at desc);

create index if not exists audit_logs_business_created_idx
  on public.audit_logs (business_id, created_at desc);

alter table public.agent_guardrails enable row level security;
alter table public.agent_events enable row level security;
alter table public.audit_logs enable row level security;
