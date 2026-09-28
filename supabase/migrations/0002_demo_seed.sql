do $$
declare
  v_business_id uuid;
begin
  select id into v_business_id
  from public.businesses
  where slug = 'northstar-dental';

  if v_business_id is null then
    insert into public.businesses (name, slug, timezone, booking_provider)
    values ('Northstar Dental', 'northstar-dental', 'Africa/Johannesburg', 'inmotion')
    returning id into v_business_id;
  end if;

  if not exists (select 1 from public.services where business_id = v_business_id) then
    insert into public.services (business_id, name, description, duration_minutes, price_cents, currency)
    values
      (v_business_id, 'Consultation', 'General dental consultation', 30, 55000, 'ZAR'),
      (v_business_id, 'Cleaning', 'Routine dental cleaning', 45, 75000, 'ZAR'),
      (v_business_id, 'Teeth whitening', 'Professional teeth whitening', 60, 200000, 'ZAR'),
      (v_business_id, 'Emergency consultation', 'Urgent dental consultation requiring staff review', 30, 85000, 'ZAR');
  end if;

  if not exists (select 1 from public.business_hours where business_id = v_business_id) then
    insert into public.business_hours (business_id, day_of_week, opens_at, closes_at, closed)
    values
      (v_business_id, 0, null, null, true),
      (v_business_id, 1, '08:00', '17:00', false),
      (v_business_id, 2, '08:00', '17:00', false),
      (v_business_id, 3, '08:00', '17:00', false),
      (v_business_id, 4, '08:00', '17:00', false),
      (v_business_id, 5, '08:00', '17:00', false),
      (v_business_id, 6, '08:00', '13:00', false);
  end if;
end $$;
