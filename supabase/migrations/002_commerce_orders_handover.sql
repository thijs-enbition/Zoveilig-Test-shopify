-- 002_commerce_orders_handover.sql
-- Manual operational handover state, kept SEPARATE from activation_status
-- (distinct lifecycle). text + CHECK (matches every other status column here;
-- easier to evolve than a Postgres enum).

alter table public.commerce_orders
  add column operational_handover_status text not null default 'not_ready';

alter table public.commerce_orders
  add constraint commerce_orders_operational_handover_check
  check (operational_handover_status = any (array[
    'not_ready','ready','in_progress','completed','failed','manual_review']));
