create type public.notification_status as enum ('unread','read','dismissed');
create type public.notification_channel as enum ('in_app','whatsapp','email');
create type public.escalation_status as enum ('pending','sent','cancelled','completed');

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_type text not null,
  recipient_role public.business_role,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  channel public.notification_channel not null default 'in_app',
  delay_minutes integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  event_type text not null,
  title text not null,
  body text not null,
  status public.notification_status not null default 'unread',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.escalation_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  notification_rule_id uuid references public.notification_rules(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  event_type text not null,
  scheduled_for timestamptz not null,
  status public.escalation_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_user_status_idx
  on public.notifications (user_id, status, created_at desc);

create index if not exists escalation_jobs_due_idx
  on public.escalation_jobs (status, scheduled_for);

alter table public.notification_rules enable row level security;
alter table public.notifications enable row level security;
alter table public.escalation_jobs enable row level security;
