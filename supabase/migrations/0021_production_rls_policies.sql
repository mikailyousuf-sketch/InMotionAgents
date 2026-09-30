-- Comprehensive tenant RLS policies for production-facing tables.

create or replace function public.is_business_admin(target_business_id uuid)
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
      and bm.role in ('owner','admin')
  );
$$;

create or replace function public.is_business_owner(target_business_id uuid)
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
      and bm.role = 'owner'
  );
$$;

-- Operational records: all workspace members may read.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'locations',
    'services',
    'resources',
    'resource_services',
    'business_hours',
    'resource_availability',
    'blocked_periods',
    'customers',
    'bookings',
    'integration_connections',
    'integration_mappings',
    'conversations',
    'messages',
    'handover_events',
    'business_policies',
    'business_faqs',
    'message_templates',
    'automations',
    'outbound_jobs',
    'contact_preferences',
    'notification_rules',
    'escalation_jobs',
    'conversation_notes',
    'agent_guardrails',
    'agent_events',
    'knowledge_suggestions',
    'handover_summaries',
    'custom_work_requests',
    'receptionist_change_proposals',
    'calls',
    'booking_settings',
    'webhook_receipts'
  ]
  loop
    execute format('drop policy if exists "workspace members read" on public.%I', table_name);
    execute format(
      'create policy "workspace members read" on public.%I for select using (public.is_business_member(business_id))',
      table_name
    );
  end loop;
end $$;

-- Configuration tables: owners/admins may create, update and delete.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'locations',
    'services',
    'resources',
    'resource_services',
    'business_hours',
    'resource_availability',
    'blocked_periods',
    'integration_connections',
    'integration_mappings',
    'business_policies',
    'business_faqs',
    'message_templates',
    'automations',
    'notification_rules',
    'agent_guardrails',
    'booking_settings'
  ]
  loop
    execute format('drop policy if exists "workspace admins insert" on public.%I', table_name);
    execute format('drop policy if exists "workspace admins update" on public.%I', table_name);
    execute format('drop policy if exists "workspace admins delete" on public.%I', table_name);

    execute format(
      'create policy "workspace admins insert" on public.%I for insert with check (public.is_business_admin(business_id))',
      table_name
    );
    execute format(
      'create policy "workspace admins update" on public.%I for update using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id))',
      table_name
    );
    execute format(
      'create policy "workspace admins delete" on public.%I for delete using (public.is_business_admin(business_id))',
      table_name
    );
  end loop;
end $$;

-- Staff-operational tables may be updated by any member where in-app staff actions need it.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers',
    'bookings',
    'conversations',
    'messages',
    'handover_events',
    'conversation_notes',
    'knowledge_suggestions',
    'handover_summaries',
    'custom_work_requests',
    'calls'
  ]
  loop
    execute format('drop policy if exists "workspace members insert" on public.%I', table_name);
    execute format('drop policy if exists "workspace members update" on public.%I', table_name);

    execute format(
      'create policy "workspace members insert" on public.%I for insert with check (public.is_business_member(business_id))',
      table_name
    );
    execute format(
      'create policy "workspace members update" on public.%I for update using (public.is_business_member(business_id)) with check (public.is_business_member(business_id))',
      table_name
    );
  end loop;
end $$;

-- Notifications are private to their recipient, while service-role workers create them.
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
on public.notifications for select
using (user_id = auth.uid() and public.is_business_member(business_id));

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications"
on public.notifications for update
using (user_id = auth.uid() and public.is_business_member(business_id))
with check (user_id = auth.uid() and public.is_business_member(business_id));

-- Audit logs can be inspected by workspace admins only.
drop policy if exists "workspace admins read audit logs" on public.audit_logs;
create policy "workspace admins read audit logs"
on public.audit_logs for select
using (business_id is not null and public.is_business_admin(business_id));

-- Team visibility: members can see their workspace roster; only owners/admins manage it through server APIs.
drop policy if exists "members read workspace memberships" on public.business_members;
create policy "members read workspace memberships"
on public.business_members for select
using (
  user_id = auth.uid()
  or public.is_business_member(business_id)
);

-- Invite rows are admin-only if accessed directly.
alter table public.business_invites enable row level security;

drop policy if exists "workspace admins read invites" on public.business_invites;
create policy "workspace admins read invites"
on public.business_invites for select
using (public.is_business_admin(business_id));

drop policy if exists "workspace admins create invites" on public.business_invites;
create policy "workspace admins create invites"
on public.business_invites for insert
with check (public.is_business_admin(business_id));

drop policy if exists "workspace admins update invites" on public.business_invites;
create policy "workspace admins update invites"
on public.business_invites for update
using (public.is_business_admin(business_id))
with check (public.is_business_admin(business_id));

drop policy if exists "workspace admins delete invites" on public.business_invites;
create policy "workspace admins delete invites"
on public.business_invites for delete
using (public.is_business_admin(business_id));
