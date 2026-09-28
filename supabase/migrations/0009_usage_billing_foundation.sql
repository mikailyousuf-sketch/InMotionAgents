create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  monthly_price_cents integer,
  currency text not null default 'ZAR',
  limits jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade unique,
  plan_id uuid references public.plans(id) on delete set null,
  status text not null default 'trial',
  provider text,
  external_customer_id text,
  external_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_type text not null,
  quantity numeric not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_business_created_idx
  on public.usage_events (business_id, created_at desc);

insert into public.plans (code, name, monthly_price_cents, currency, limits)
values (
  'development',
  'Development',
  0,
  'ZAR',
  '{"conversations": null, "messages": null, "bookings": null}'::jsonb
)
on conflict (code) do nothing;
