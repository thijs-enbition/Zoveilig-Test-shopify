-- 000_baseline.sql
-- Canonical foundation for "Zo Veilig Commerce". The REPOSITORY is the source of truth.
-- Hand-authored to mirror the documented production schema (NO production dump).
-- Order matters: extensions -> functions -> tables (dependency order) -> triggers -> RLS.
--
-- Grant posture: Supabase applies its standard default privileges on new public tables
-- (anon/authenticated/service_role receive table-level DML automatically). RLS is enabled
-- below with NO policies, so anon & authenticated receive ZERO rows; only service_role
-- (RLS-exempt) can read/write. We rely on Supabase's managed defaults for parity rather
-- than re-issuing GRANTs (verified DEV == production in the Gate 1 report).

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists "uuid-ossp";

-- ============================ functions ============================
create or replace function public.generate_reference(prefix text)
returns text
language plpgsql
set search_path to ''
as $$
begin
  return upper(prefix)
    || '-'
    || to_char(now(), 'YYYYMMDD')
    || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================ tables ============================
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_reference text not null unique default public.generate_reference('LEAD'),
  first_name text,
  last_name text,
  email text,
  phone text,
  postcode text,
  preferred_contact_method text,
  source text,
  status text not null default 'new',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  gclid text,
  fbclid text,
  marketing_consent boolean not null default false,
  privacy_policy_version text,
  consent_recorded_at timestamptz,
  odoo_lead_id text,
  odoo_sync_status text not null default 'not_ready',
  odoo_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_contact_method_check
    check (preferred_contact_method is null
           or preferred_contact_method = any (array['email','phone','whatsapp'])),
  constraint leads_status_check
    check (status = any (array['new','contact_requested','qualified','checkout_started','converted','closed'])),
  constraint leads_odoo_sync_status_check
    check (odoo_sync_status = any (array['not_ready','ready','pending','synced','failed']))
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  product_name text not null,
  product_type text not null,
  solution_category text,
  active boolean not null default true,
  invoice_trigger text,
  requires_delivery boolean not null default false,
  requires_activation boolean not null default false,
  is_recurring boolean not null default false,
  odoo_product_id text,
  odoo_product_template_id text,
  odoo_mapping_status text not null default 'unmapped',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_product_type_check
    check (product_type = any (array['package','hardware','service','activation','subscription','addon'])),
  constraint products_invoice_trigger_check
    check (invoice_trigger is null
           or invoice_trigger = any (array['ordered','delivered','recurring','manual_review'])),
  constraint products_odoo_mapping_status_check
    check (odoo_mapping_status = any (array['unmapped','mapping_review','mapped','error']))
);

create table public.package_components (
  id uuid primary key default gen_random_uuid(),
  package_product_id uuid not null references public.products(id) on delete restrict,
  component_product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric not null default 1,
  required boolean not null default true,
  sort_order integer not null default 0,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  constraint package_components_quantity_check check (quantity > 0),
  constraint package_components_not_self_check check (package_product_id <> component_product_id),
  constraint package_components_date_check
    check (valid_to is null or valid_from is null or valid_to >= valid_from),
  constraint package_components_package_product_id_component_product_id__key
    unique (package_product_id, component_product_id, valid_from)
);

create table public.package_selections (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  package_product_id uuid not null references public.products(id) on delete restrict,
  package_sku_snapshot text not null,
  package_name_snapshot text not null,
  contract_term_months integer,
  monthly_amount numeric,
  activation_amount numeric,
  initial_payment_amount numeric,
  currency text not null default 'EUR',
  selection_source text,
  selected_at timestamptz not null default now(),
  constraint package_selections_contract_term_check
    check (contract_term_months is null or contract_term_months > 0),
  constraint package_selections_amounts_check
    check (coalesce(monthly_amount, 0) >= 0
           and coalesce(activation_amount, 0) >= 0
           and coalesce(initial_payment_amount, 0) >= 0)
);

create table public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique default public.generate_reference('ORDER'),
  lead_id uuid references public.leads(id) on delete set null,
  package_selection_id uuid references public.package_selections(id) on delete set null,
  shopify_order_id text unique,
  shopify_order_name text,
  shopify_customer_id text,
  shopify_checkout_id text,
  financial_status text,
  fulfillment_status text,
  currency text not null default 'EUR',
  subtotal_amount numeric,
  tax_amount numeric,
  total_amount numeric,
  initial_payment_amount numeric,
  monthly_amount numeric,
  activation_amount numeric,
  contract_term_months integer,
  payment_status text not null default 'pending',
  sepa_status text not null default 'not_required',
  activation_status text not null default 'waiting',
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  odoo_partner_id text,
  odoo_sale_order_id text,
  odoo_subscription_id text,
  odoo_handoff_status text not null default 'not_ready',
  odoo_handoff_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_orders_payment_status_check
    check (payment_status = any (array['pending','authorized','paid','partially_refunded','refunded','failed','cancelled'])),
  constraint commerce_orders_sepa_status_check
    check (sepa_status = any (array['not_required','required','pending','active','failed','cancelled'])),
  constraint commerce_orders_activation_status_check
    check (activation_status = any (array['waiting','ready','in_progress','active','blocked','cancelled'])),
  constraint commerce_orders_odoo_handoff_check
    check (odoo_handoff_status = any (array['not_ready','ready','exported','synced','failed']))
);

create table public.commerce_order_lines (
  id uuid primary key default gen_random_uuid(),
  commerce_order_id uuid not null references public.commerce_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku_snapshot text not null,
  product_name_snapshot text not null,
  product_type_snapshot text not null,
  quantity_ordered numeric not null default 1,
  quantity_fulfilled numeric not null default 0,
  quantity_cancelled numeric not null default 0,
  quantity_refunded numeric not null default 0,
  unit_price numeric not null default 0,
  tax_rate numeric,
  line_total numeric not null default 0,
  invoice_trigger_snapshot text,
  requires_delivery boolean not null default false,
  requires_activation boolean not null default false,
  is_recurring boolean not null default false,
  odoo_product_id text,
  odoo_sale_order_line_id text,
  odoo_invoice_line_id text,
  odoo_sync_status text not null default 'not_ready',
  created_at timestamptz not null default now(),
  constraint commerce_order_lines_product_type_check
    check (product_type_snapshot = any (array['package','hardware','service','activation','subscription','addon'])),
  constraint commerce_order_lines_invoice_trigger_check
    check (invoice_trigger_snapshot is null
           or invoice_trigger_snapshot = any (array['ordered','delivered','recurring','manual_review'])),
  constraint commerce_order_lines_quantity_check
    check (quantity_ordered > 0 and quantity_fulfilled >= 0
           and quantity_cancelled >= 0 and quantity_refunded >= 0),
  constraint commerce_order_lines_amount_check
    check (unit_price >= 0 and line_total >= 0)
);

create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  previous_status text,
  new_status text not null,
  changed_by text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================ updated_at triggers ============================
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger commerce_orders_set_updated_at
  before update on public.commerce_orders
  for each row execute function public.set_updated_at();

-- ============================ RLS (enabled, deny-by-default: no policies) ============================
alter table public.leads                 enable row level security;
alter table public.products              enable row level security;
alter table public.package_components    enable row level security;
alter table public.package_selections    enable row level security;
alter table public.commerce_orders       enable row level security;
alter table public.commerce_order_lines  enable row level security;
alter table public.status_history        enable row level security;
