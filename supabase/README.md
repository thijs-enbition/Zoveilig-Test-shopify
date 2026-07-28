# Zo Veilig Commerce — Supabase (repository is the source of truth)

Flow is one-directional: **Git → migration files → DEV → Production.**
The production database is never the baseline (no `supabase db dump`).

## Gate boundary (prevents accidental over-application)

`supabase db push` applies **every** migration present in `supabase/migrations/`.
To make a Gate 1 push unable to apply Gate 2 work, **only the Gate 1 files exist in the
repo right now**:

| File | Gate |
|---|---|
| `000_baseline.sql` | 1 |
| `001_leads_journey_attribution.sql` | 1 |
| `002_commerce_orders_handover.sql` | 1 |
| `003_order_lines_idempotency.sql` | 1 |
| `005_versioning.sql` | 1 |
| `004_rpc.sql` | 2 — **not created yet** |
| `006_reporting_views.sql` | 2 — **not created yet** |

`004` and `006` are authored only after explicit Gate 2 approval. Until then a push
(or per-file apply) cannot touch server logic or reporting.

## Version tracking

`versions.json` holds `schema_version`, `edge_functions_version`,
`shopify_integration_version`. Each promotion records a row in
`internal.deployment_registry` (private schema, not Data-API exposed) with the
migration head and git SHA, so every deployment is identifiable per environment.

## Environments

- **DEV** — `Zo Veilig Commerce — DEV`, built purely from these files, test data only,
  DEV-only secrets, wired only to the Shopify development store.
- **PROD** — `Zo Veilig Commerce` (existing). Reached only after gate sign-off, via the
  same reviewed migration files; a read-only drift check runs before Gate 4.
