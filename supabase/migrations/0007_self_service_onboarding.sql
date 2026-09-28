alter table public.businesses
  add column if not exists description text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists tone text not null default 'friendly_professional',
  add column if not exists agent_name text not null default 'Ava',
  add column if not exists onboarding_complete boolean not null default false;

create table if not exists public.business_policies (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  policy_type text not null,
  title text not null,
  content text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.business_faqs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  question text not null,
  answer text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists business_policies_business_idx
  on public.business_policies (business_id, active);

create index if not exists business_faqs_business_idx
  on public.business_faqs (business_id, active);
