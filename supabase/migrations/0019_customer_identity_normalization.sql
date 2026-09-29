update public.customers
set
  phone = nullif(regexp_replace(coalesce(phone,''), '\D', '', 'g'), ''),
  email = nullif(lower(trim(coalesce(email,''))), '')
where phone is not null or email is not null;

create index if not exists customers_business_phone_lookup_idx
  on public.customers (business_id, phone)
  where phone is not null;

create index if not exists customers_business_email_lookup_idx
  on public.customers (business_id, email)
  where email is not null;
