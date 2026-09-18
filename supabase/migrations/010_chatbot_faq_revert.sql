-- 010_chatbot_faq_revert.sql
-- Reverses 009_chatbot_faq.sql. The AI FAQ chatbot build (feature/chatbot-faq-2026-09-17)
-- was shelved as a content/product decision for Robi rather than shipped -- see
-- docs/chatbot-idea-discussion-2026-09-18.md. The feature branch was deleted and the
-- chatbot-faq Edge Function removed from the DEV project; this drops the schema it used.
--
-- 009 itself is NOT edited in place (it's still real history: it *was* applied to DEV and
-- then reverted, not "never happened") -- this migration undoes it going forward instead,
-- same convention as any other rollback in this repo's append-only migration history.

drop function if exists public.increment_chatbot_rate_limit(text, text, timestamptz);

drop table if exists public.chatbot_rate_limits;
drop table if exists public.chatbot_kb_entries;

alter table public.webhook_failures drop constraint webhook_failures_source_check;
alter table public.webhook_failures add constraint webhook_failures_source_check
  check (source = any (array['vista', 'camera_hardware', 'onderweg_coming_soon']));
