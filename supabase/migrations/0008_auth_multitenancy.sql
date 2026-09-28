do $
begin
  create type public.business_role as enum ('owner','admin','staff');
exception
  when duplicate_object then null;
end $;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.business_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

alter table public.businesses
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists business_members_user_idx
  on public.business_members (user_id);

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
  );
$$;

alter table public.businesses enable row level security;
alter table public.locations enable row level security;
alter table public.services enable row level security;
alter table public.resources enable row level security;
alter table public.resource_services enable row level security;
alter table public.business_hours enable row level security;
alter table public.resource_availability enable row level security;
alter table public.blocked_periods enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.integration_connections enable row level security;
alter table public.integration_mappings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.handover_events enable row level security;
alter table public.business_policies enable row level security;
alter table public.business_faqs enable row level security;
alter table public.business_members enable row level security;
alter table public.user_profiles enable row level security;

drop policy if exists "members can read businesses" on public.businesses;
create policy "members can read businesses"
on public.businesses for select
using (public.is_business_member(id));

drop policy if exists "owners can update businesses" on public.businesses;
create policy "owners can update businesses"
on public.businesses for update
using (
  exists (
    select 1 from public.business_members bm
    where bm.business_id = id
      and bm.user_id = auth.uid()
      and bm.role in ('owner','admin')
  )
);

drop policy if exists "users read own memberships" on public.business_members;
create policy "users read own memberships"
on public.business_members for select
using (user_id = auth.uid());

drop policy if exists "users read own profile" on public.user_profiles;
create policy "users read own profile"
on public.user_profiles for select
using (id = auth.uid());

drop policy if exists "users update own profile" on public.user_profiles;
create policy "users update own profile"
on public.user_profiles for update
using (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
