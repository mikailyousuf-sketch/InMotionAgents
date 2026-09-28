create table if not exists public.business_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role public.business_role not null default 'staff',
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create unique index if not exists business_invites_pending_unique
  on public.business_invites (business_id, lower(email))
  where accepted_at is null;

alter table public.business_invites enable row level security;

drop policy if exists "members read invites" on public.business_invites;
create policy "members read invites"
on public.business_invites for select
using (
  exists (
    select 1
    from public.business_members bm
    where bm.business_id = business_invites.business_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner','admin')
  )
);
