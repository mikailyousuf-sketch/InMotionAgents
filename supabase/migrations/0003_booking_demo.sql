do $$
declare
  v_business_id uuid;
  v_location_id uuid;
  v_sarah_id uuid;
  v_khan_id uuid;
  v_cleaning_id uuid;
  v_consult_id uuid;
begin
  select id into v_business_id from public.businesses where slug = 'northstar-dental';

  if not exists (select 1 from public.locations where business_id = v_business_id) then
    insert into public.locations (business_id, name, address, timezone)
    values (v_business_id, 'Northstar Dental Main', 'Pretoria, Gauteng, South Africa', 'Africa/Johannesburg')
    returning id into v_location_id;
  else
    select id into v_location_id from public.locations where business_id = v_business_id limit 1;
  end if;

  if not exists (select 1 from public.resources where business_id = v_business_id) then
    insert into public.resources (business_id, location_id, name, resource_type)
    values
      (v_business_id, v_location_id, 'Hygienist Sarah', 'staff'),
      (v_business_id, v_location_id, 'Dr Khan', 'staff');
  end if;

  select id into v_sarah_id from public.resources where business_id = v_business_id and name = 'Hygienist Sarah' limit 1;
  select id into v_khan_id from public.resources where business_id = v_business_id and name = 'Dr Khan' limit 1;
  select id into v_cleaning_id from public.services where business_id = v_business_id and name = 'Cleaning' limit 1;
  select id into v_consult_id from public.services where business_id = v_business_id and name = 'Consultation' limit 1;

  if v_sarah_id is not null and v_cleaning_id is not null then
    insert into public.resource_services (resource_id, service_id)
    values (v_sarah_id, v_cleaning_id)
    on conflict do nothing;
  end if;

  if v_khan_id is not null and v_consult_id is not null then
    insert into public.resource_services (resource_id, service_id)
    values (v_khan_id, v_consult_id)
    on conflict do nothing;
  end if;
end $$;
