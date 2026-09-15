-- 008_webhook_failures.sql
-- Diagnostic log for failed ZV_LEAD_ENDPOINT sends (Vista, camera-hardware, Veilig Onderweg
-- "Binnenkort beschikbaar"). See docs/lead-endpoint-diagnosis-2026-09-15.md for the incident
-- this exists to prevent recurring silently, and docs/lead-webhook-failure-logging-2026-09-15.md
-- for what this table is and isn't used for.
--
-- Deliberately holds no lead PII (no name/email/phone) — it's a diagnostic trail, not a second
-- copy of lead data. Same RLS posture as 000_baseline.sql: enabled, no anon/authenticated
-- policies, only service_role (used by supabase/functions/log-webhook-failure) reads/writes.

create table public.webhook_failures (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  endpoint_host text,
  error_type text not null,
  error_message text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint webhook_failures_source_check
    check (source = any (array['vista', 'camera_hardware', 'onderweg_coming_soon'])),
  constraint webhook_failures_error_type_check
    check (error_type = any (array['network_error', 'timeout', 'exception']))
);

alter table public.webhook_failures enable row level security;
