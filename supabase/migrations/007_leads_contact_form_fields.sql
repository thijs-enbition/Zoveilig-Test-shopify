-- 007_leads_contact_form_fields.sql
-- Adds the fields the Contact page's "Plan een gratis adviesgesprek" form
-- captures that don't already exist on public.leads: topic, preferred
-- time-of-day to call, and an optional free-text message. Short, stable
-- codes + CHECK (matching the leads_status_check / leads_odoo_sync_status_check
-- idiom already used on this table), not the raw Dutch label text.

alter table public.leads
  add column subject                text,
  add column preferred_contact_time text,
  add column message                text;

alter table public.leads
  add constraint leads_subject_check
  check (subject is null or subject = any (array[
    'advies','langer_thuis','mijn_thuis','veilig_onderweg','zakelijk','bestaand_klant']));

alter table public.leads
  add constraint leads_preferred_contact_time_check
  check (preferred_contact_time is null or preferred_contact_time = any (array[
    'any','morning','afternoon','evening']));
