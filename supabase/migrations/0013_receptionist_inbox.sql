alter table public.conversations
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null,
  add column if not exists last_customer_message_at timestamptz,
  add column if not exists last_staff_message_at timestamptz,
  add column if not exists unread_for_staff integer not null default 0;

create table if not exists public.conversation_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversations_staff_queue_idx
  on public.conversations (business_id, status, unread_for_staff, updated_at desc);

create index if not exists conversation_notes_conversation_idx
  on public.conversation_notes (conversation_id, created_at desc);

alter table public.conversation_notes enable row level security;
