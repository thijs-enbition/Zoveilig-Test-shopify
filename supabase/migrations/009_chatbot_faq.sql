-- 009_chatbot_faq.sql
-- Schema for the storefront FAQ chatbot (docs/chatbot-faq-design-2026-09-17.md).
--
-- chatbot_kb_entries: knowledge base the chatbot-faq Edge Function answers from,
-- synced from templates/page.klantenservice.json by scripts/sync_chatbot_kb.py
-- (keyed on source_block_id, e.g. "faq12", "faqlt3"). Removed FAQ blocks are marked
-- active=false, never hard-deleted, so there's still an audit trail of retired content.
--
-- chatbot_rate_limits: per-IP-hash abuse guard for the Edge Function. Two scopes share
-- one table rather than one row per ip_hash, because a single window can't express both
-- a short "session" cap and a rolling "day" cap at once: 'session' buckets are a 30-minute
-- rolling window (30 msgs), 'day' buckets are the current UTC calendar day (100 msgs/day).
-- Both limits (and the 30-minute session-window length) are placeholders per the design
-- doc — tune once real usage is observed. ip_hash is sha256 of the raw IP (unsalted, same
-- convention as assets/zv-measurement.js's client-side hashEmail()) — never the raw IP.
--
-- Same RLS posture as 000_baseline.sql/008_webhook_failures.sql: enabled, no anon/
-- authenticated policies, only service_role (the chatbot-faq function, the sync script)
-- reads/writes.

create table public.chatbot_kb_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  answer text not null,
  source_block_id text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger chatbot_kb_entries_set_updated_at
  before update on public.chatbot_kb_entries
  for each row execute function public.set_updated_at();

create table public.chatbot_rate_limits (
  ip_hash text not null,
  scope text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (ip_hash, scope, window_start),
  constraint chatbot_rate_limits_scope_check check (scope = any (array['session', 'day']))
);

-- Atomic "insert or increment" for one (ip_hash, scope, window_start) bucket, so
-- concurrent requests from the same visitor can't race past the limit between a
-- read and a write. Returns the post-increment count for the caller to compare
-- against its threshold.
create or replace function public.increment_chatbot_rate_limit(
  p_ip_hash text,
  p_scope text,
  p_window_start timestamptz
)
returns integer
language plpgsql
set search_path to ''
as $$
declare
  new_count integer;
begin
  insert into public.chatbot_rate_limits (ip_hash, scope, window_start, count)
  values (p_ip_hash, p_scope, p_window_start, 1)
  on conflict (ip_hash, scope, window_start)
  do update set count = public.chatbot_rate_limits.count + 1, updated_at = now()
  returning count into new_count;

  return new_count;
end;
$$;

alter table public.chatbot_kb_entries  enable row level security;
alter table public.chatbot_rate_limits enable row level security;

-- Extend log-webhook-failure's source allow-list with the chatbot widget's failure
-- source. Adds only this one value — the pre-existing missing 'contact_page' gap
-- (docs/contact-odoo-dual-write-2026-09-16.md) is a separate, untouched issue.
alter table public.webhook_failures drop constraint webhook_failures_source_check;
alter table public.webhook_failures add constraint webhook_failures_source_check
  check (source = any (array['vista', 'camera_hardware', 'onderweg_coming_soon', 'chatbot']));
