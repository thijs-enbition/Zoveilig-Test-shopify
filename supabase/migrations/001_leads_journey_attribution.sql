-- 001_leads_journey_attribution.sql
-- Journey identity + attribution columns + normalised match keys.
-- No global unique on email/phone (one person/household may hold several contracts).

alter table public.leads
  add column journey_id      text,
  add column landing_page    text,
  add column referrer        text,
  add column first_page_url  text,
  add column last_page_url   text,
  add column email_normalized text
    generated always as (lower(btrim(email))) stored,
  add column phone_normalized text
    generated always as (nullif(regexp_replace(phone, '[^0-9]', '', 'g'), '')) stored;

-- journey_id: primary anonymous->known correlation; unique ONLY when present.
create unique index leads_journey_id_key
  on public.leads (journey_id)
  where journey_id is not null;

-- Matching support only (NON-unique on purpose).
create index leads_email_normalized_idx
  on public.leads (email_normalized)
  where email_normalized is not null;

create index leads_phone_normalized_idx
  on public.leads (phone_normalized)
  where phone_normalized is not null;
