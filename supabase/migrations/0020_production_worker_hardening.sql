-- Production hardening: webhook idempotency and escalation worker claims.

create table if not exists public.webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  business_id uuid references public.businesses(id) on delete cascade,
  status text not null default 'processing'
    check (status in ('processing','completed','failed')),
  last_error text,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create index if not exists webhook_receipts_status_idx
  on public.webhook_receipts (provider, status, updated_at);

alter table public.webhook_receipts enable row level security;

alter table public.escalation_jobs
  add column if not exists claimed_at timestamptz,
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text;

create index if not exists escalation_jobs_claim_idx
  on public.escalation_jobs (status, scheduled_for, claimed_at)
  where status = 'pending';
