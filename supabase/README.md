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
| `007_leads_contact_form_fields.sql` | 1 — schema-only `leads` extension (subject/preferred_contact_time/message), added for the Contact page's `capture-lead` wiring |
| `008_webhook_failures.sql` | 1 — new, isolated `webhook_failures` diagnostic table (no lead PII) for the `log-webhook-failure` Edge Function; doesn't touch `leads` or any existing table |
| `004_rpc.sql` | 2 — **not created yet** |
| `006_reporting_views.sql` | 2 — **not created yet** |

`004` and `006` are authored only after explicit Gate 2 approval. Until then a push
(or per-file apply) cannot touch server logic or reporting. `007` deliberately keeps
that numbering gap open — it's a plain schema alter (same shape as `001`/`002`), not
the RPC/reporting-views work those two reserved names are for.

## Edge Functions

`supabase/functions/capture-lead` (added 2026-09-09) is the first Edge Function built
against this schema. It is scoped narrowly to the Contact page's "Plan een gratis
adviesgesprek" form: validates required fields + a honeypot, inserts one `leads` row
(`status = 'contact_requested'`) and one `status_history` row, and stops — no Odoo call.
`leads.odoo_sync_status` stays at its `not_ready` default; automated Odoo sync is still
Phase 2 per `docs/architecture/adr/ADR-004-odoo-deferred-phase-2.md`. It does **not**
implement the broader Gate 2 recommendations still open in the reference architecture
(§12): per-IP/journey rate limiting beyond the honeypot, the full CORS allowlist story,
or wiring from Keuzehulp/attribution capture — those remain for whenever Gate 2 is
formally signed off.

`supabase/functions/log-webhook-failure` (added 2026-09-15) is the second Edge
Function. It exists solely so a failed `ZV_LEAD_ENDPOINT` send (Vista, camera-hardware,
Veilig Onderweg "Binnenkort beschikbaar" — see
`docs/lead-endpoint-diagnosis-2026-09-15.md` for the incident that motivated this)
becomes visible in `webhook_failures` instead of disappearing into an empty
client-side `.catch()`. Same CORS-origin-allowlist pattern as `capture-lead`; inserts
one row and stops, no PII, no retry logic. **Only catches network-level failures
(DNS/connection failure, our own client-side timeout, or a synchronous send
exception)** — the storefront calls `ZV_LEAD_ENDPOINT` with `mode: 'no-cors'`, so a
non-2xx response from that endpoint is structurally invisible to the browser and
cannot be logged here either; closing that gap means dropping `no-cors` (needs the
endpoint to support real CORS) — a separate decision, not made here.

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
