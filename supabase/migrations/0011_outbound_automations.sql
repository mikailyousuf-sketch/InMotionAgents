create type public.automation_status as enum ('active','paused','archived');
create type public.automation_trigger as enum (
  'booking_created',
  'booking_reminder',
  'lead_followup',
  'scheduled',
  'manual'
);
create type public.outbound_job_status as enum (
  'pending',
  'processing',
  'sent',
  'failed',
  'cancelled',
  'skipped'
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  channel text not null default 'whatsapp',
  body text not null,
  template_type text not null default 'custom',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  trigger_type public.automation_trigger not null,
  status public.automation_status not null default 'active',
  channel text not null default 'whatsapp',
  template_id uuid references public.message_templates(id) on delete set null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outbound_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  automation_id uuid references public.automations(id) on delete set null,
  template_id uuid references public.message_templates(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  channel text not null default 'whatsapp',
  destination text,
  rendered_body text not null,
  scheduled_for timestamptz not null,
  status public.outbound_job_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  external_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.contact_preferences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel text not null,
  opted_out boolean not null default false,
  opted_out_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, customer_id, channel)
);

create index if not exists outbound_jobs_due_idx
  on public.outbound_jobs (status, scheduled_for);

create index if not exists automations_business_trigger_idx
  on public.automations (business_id, trigger_type, status);

create index if not exists message_templates_business_idx
  on public.message_templates (business_id, active);

alter table public.message_templates enable row level security;
alter table public.automations enable row level security;
alter table public.outbound_jobs enable row level security;
alter table public.contact_preferences enable row level security;
