create table if not exists public.booking_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  cancellation_window_hours integer not null default 12 check (cancellation_window_hours >= 0),
  reschedule_window_hours integer not null default 12 check (reschedule_window_hours >= 0),
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes in (5,10,15,20,30,60)),
  allow_customer_cancellation boolean not null default true,
  allow_customer_reschedule boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.booking_settings (business_id)
select id from public.businesses
on conflict (business_id) do nothing;

alter table public.booking_settings enable row level security;
