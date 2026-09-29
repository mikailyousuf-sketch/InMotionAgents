create extension if not exists btree_gist;

-- Existing workspaces were allowed to have services without mappings.
-- Preserve their behaviour once the provider becomes strict by explicitly
-- mapping currently unmapped services to all active resources in the business.
insert into public.resource_services (resource_id, service_id)
select r.id, s.id
from public.services s
join public.resources r
  on r.business_id = s.business_id
 and r.active = true
where s.active = true
  and not exists (
    select 1
    from public.resource_services rs
    where rs.service_id = s.id
  )
on conflict do nothing;

-- Database-level protection against two simultaneous requests booking
-- the same resource for overlapping times.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_resource_no_overlap'
  ) then
    alter table public.bookings
      add constraint bookings_resource_no_overlap
      exclude using gist (
        resource_id with =,
        tstzrange(starts_at, ends_at, '[)') with &&
      )
      where (
        resource_id is not null
        and status in ('pending'::public.booking_status, 'confirmed'::public.booking_status)
      );
  end if;
end $$;

-- Outbound jobs are idempotent. The same logical reminder/follow-up can
-- safely be scheduled multiple times without creating duplicate messages.
alter table public.outbound_jobs
  add column if not exists dedupe_key text,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists max_attempts integer not null default 3;

create unique index if not exists outbound_jobs_dedupe_idx
  on public.outbound_jobs (business_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists outbound_jobs_retry_idx
  on public.outbound_jobs (status, next_attempt_at)
  where status in ('pending','failed');

-- Track why a booking job was invalidated without losing its history.
create index if not exists outbound_jobs_booking_pending_idx
  on public.outbound_jobs (business_id, booking_id, status)
  where booking_id is not null;
