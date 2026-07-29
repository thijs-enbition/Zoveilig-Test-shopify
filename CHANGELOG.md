# Changelog

All notable changes to Zo Veilig Commerce are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Repository milestones use
SemVer with a gate suffix. The **repository** version can differ from the **schema/component**
versions in `supabase/versions.json`: the repo is `v0.1.0-gate1` because application logic and
integrations are not yet implemented, while the schema/component versions are `1.0.0`.

## [0.1.0-gate1] — 2026-07-29

Gate 1 — Database Foundation. Repository‑first: `Git → migrations → DEV → Production`.

### Added
- Supabase DEV project "Zo Veilig Commerce — DEV" (eu‑west‑1), built entirely from
  version‑controlled migrations. Production untouched.
- Migrations (hand‑authored, no production dump):
  - `000_baseline` — 7 core tables, `generate_reference()` / `set_updated_at()` + triggers,
    `pgcrypto` / `uuid-ossp`, RLS enabled with no policies (deny‑by‑default for the Data‑API roles).
  - `001` — `leads.journey_id` (partial‑unique) + attribution columns + generated
    `email_normalized` / `phone_normalized` with indexes.
  - `002` — `commerce_orders.operational_handover_status` (text + CHECK).
  - `003` — unique `(commerce_order_id, product_id)` on `commerce_order_lines`.
  - `005` — `internal.deployment_registry` (private schema, RLS, not Data‑API exposed).
- Reference architecture, 14 ADRs, glossary, 4 Mermaid diagrams, and a modular `/docs`
  structure (`operations`, `security`, `integrations`, `roadmap`).

### Governance
- Gate boundary: only Gate 1 migrations present; `004_rpc` and `006_reporting_views` are
  intentionally absent until Gate 2.
- First deployment version recorded in `internal.deployment_registry` (schema 1.0.0).

### Verified
- DEV equals the documented production baseline plus exactly the five Gate 1 migrations;
  constraints identical by name and definition; RLS enabled, 0 policies; no unexpected drift.

### Not included (by design)
- Edge Functions, RPCs, Shopify integration, webhooks, catalogue seed, reporting views.

### Versions at this milestone
- Repository: `v0.1.0-gate1`
- Schema / Edge Functions / Shopify integration (`supabase/versions.json`): `1.0.0` each
  (unchanged — application logic and integrations are Gate 2+).
