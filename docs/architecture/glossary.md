# Glossary — Zo Veilig Commerce

One‑line definitions of the platform's key terms. See the [reference architecture](./zo-veilig-commerce-architecture.md) for detail.

| Term | Definition |
|---|---|
| **Journey ID** (`zv_journey_id`) | A first‑party identifier created in the browser on the first interaction that correlates an anonymous visitor to a later known lead and order; it is a correlation key, not authentication, and holds no PII. |
| **Lead** | A person who has shown meaningful intent or submitted information; the anonymous‑to‑known aggregate stored in the `leads` table. |
| **Lead Reference** (`LEAD-YYYYMMDD-XXXXXX`) | The durable, human‑readable business handle for a lead, generated at creation and used across storefront, checkout and operations. |
| **Package** | A sellable bundle (e.g. Langer Thuis Zeker) that expands into several operational components rather than being a single item. |
| **Package Component** | A part of a package (hub, sensor, activation fee, recurring service) defined in `package_components`; the bill‑of‑materials. |
| **Package Selection** | A record of what a visitor intended to buy *before* payment, with a commercial snapshot; stored in `package_selections`. |
| **Commercial snapshot** | Price/SKU/name captured at the moment of selection or order so later catalogue changes never rewrite history. |
| **Shopify Order** | The order created in Shopify at successful payment; the commercial/payment source of record. |
| **Commerce Order** (Operational Order) | The Supabase `commerce_orders` record created from the Shopify order via webhook; owns the operational lifecycle and handover. |
| **Commerce Order Line** | A single expanded line of a commerce order (one per product), produced by expanding the package's components. |
| **Package expansion** | Turning a purchased package header into its operational component lines via `package_components`. |
| **Status History** | The append‑only audit table (`status_history`) recording who/what/why for every meaningful state change; also stores webhook/correlation/idempotency evidence in `metadata`. |
| **Operational Handover** | The manual step (Phase 1) where a paid order is passed to operations for provisioning; tracked by `operational_handover_status`. |
| **First‑touch attribution** | Attribution values captured on the *first* lead write (UTM, click IDs, landing/referrer/first page) and never overwritten. |
| **Last‑touch attribution** | Values updated on each interaction (e.g. `last_page_url`) reflecting the most recent context. |
| **Source of truth** | The single authoritative location for a thing; the Git repository for schema, and one system of record per business‑data type. |
| **Idempotency** | The property that processing the same event more than once (e.g. a retried webhook) produces no duplicate data; anchored on `shopify_order_id` and the order‑line unique index. |
| **RLS (Row‑Level Security)** | Postgres access control enabled on every table with no policies, so the Data‑API roles `anon` and `authenticated` receive no rows (deny‑by‑default); privileged roles (`postgres`, owners, `service_role`, `BYPASSRLS`) operate outside RLS. |
| **service_role** | The privileged Supabase key used only inside Edge Functions/tooling; it bypasses RLS and is never present in the storefront/browser. |
| **Edge Function** | A Supabase server‑side function that is the secure boundary between the storefront and the database (`capture-lead`, `shopify-order-webhook`). |
| **Reporting view** (`vw_*`) | A read‑only SQL view exposing a governed, PII‑minimised slice of operational data to BI tools, so dashboards never query base tables. |
| **Deployment registry** | `internal.deployment_registry`, a private‑schema table recording each environment deployment's versions and git SHA. |
| **Gate** | One of the four approval checkpoints (DEV foundation → server logic → Shopify DEV integration → Production); nothing proceeds without explicit sign‑off. |
| **Migration** | A version‑controlled SQL file applied in order to evolve the schema; the only way the schema changes. |
| **ADR** | Architecture Decision Record — a short, dated document capturing one significant decision, its context and consequences. |
