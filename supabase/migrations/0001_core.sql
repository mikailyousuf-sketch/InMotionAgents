create extension if not exists pgcrypto;

create type public.booking_provider as enum ('inmotion','google','outlook','playtomic','dineplan','custom');
create type public.booking_status as enum ('pending','confirmed','cancelled','completed','no_show');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Africa/Johannesburg',
  booking_provider public.booking_provider not null default 'inmotion',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address text,
  timezone text,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer,
  currency text not null default 'ZAR',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  name text not null,
  resource_type text not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.resource_services (
  resource_id uuid not null references public.resources(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (resource_id, service_id)
);

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time,
  closes_at time,
  closed boolean not null default false,
  unique (business_id, location_id, day_of_week)
);

create table public.resource_availability (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  check (ends_at > starts_at)
);

create table public.blocked_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (ends_at > starts_at)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  resource_id uuid references public.resources(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  provider public.booking_provider not null default 'inmotion',
  external_booking_id text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'confirmed',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected',
  config jsonb not null default '{}'::jsonb,
  credentials_encrypted jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider)
);

create table public.integration_mappings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null,
  internal_entity_type text not null,
  internal_entity_id uuid not null,
  external_entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique (business_id, provider, internal_entity_type, internal_entity_id)
);

insert into public.businesses (name, slug, timezone, booking_provider)
values ('Northstar Dental', 'northstar-dental', 'Africa/Johannesburg', 'inmotion')
on conflict (slug) do nothing;
