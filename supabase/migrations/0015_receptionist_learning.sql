create type public.knowledge_suggestion_status as enum ('pending','approved','dismissed');
create type public.knowledge_suggestion_type as enum ('unanswered_question','repeated_question','historical_chat','tone_insight','policy_gap');

create table if not exists public.knowledge_suggestions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  suggestion_type public.knowledge_suggestion_type not null,
  title text not null,
  source_question text,
  suggested_answer text,
  confidence numeric,
  status public.knowledge_suggestion_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.handover_summaries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  reason text,
  customer_request text,
  ai_actions text,
  blocker text,
  suggested_next_action text,
  raw_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id)
);

create table if not exists public.custom_work_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  request_type text not null default 'custom_automation',
  title text not null,
  description text not null,
  current_systems text,
  desired_outcome text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_suggestions enable row level security;
alter table public.handover_summaries enable row level security;
alter table public.custom_work_requests enable row level security;

create index if not exists knowledge_suggestions_business_status_idx
  on public.knowledge_suggestions (business_id, status, created_at desc);

create index if not exists handover_summaries_conversation_idx
  on public.handover_summaries (conversation_id);

create index if not exists custom_work_requests_business_idx
  on public.custom_work_requests (business_id, created_at desc);
