# Lead-webhook failure visibility (2026-09-15)

**What this is:** a fix for the blind spot found in
`docs/lead-endpoint-diagnosis-2026-09-15.md` — the three `ZV_LEAD_ENDPOINT` call sites
(Vista, camera-hardware "Neem contact op", Veilig Onderweg "Binnenkort beschikbaar")
swallowed every send failure in an empty `.catch()`, which is exactly how a dead
webhook URL went unnoticed for weeks. This does not fix that specific dead URL —
that's still a separate, manual "get a current Odoo webhook URL" step from that
diagnosis doc.

## What was built

- **`assets/zv-lead-webhook.js`** — one shared `window.ZVLeadWebhook.send(payload, source)`
  used by all three call sites (`sections/oplossingen.liquid` for Vista and Onderweg,
  `sections/camera-hardware.liquid`), replacing three copies of the same inline
  fetch-with-empty-catch code. Same fire-and-forget contract as before — it never
  throws, never changes what the visitor sees — the only difference is a *detectable*
  failure now gets logged instead of disappearing.
- **`supabase/functions/log-webhook-failure`** — a second Edge Function (same shape as
  `capture-lead`: CORS origin allowlist, minimal validation, service-role insert,
  stops). Writes one row to a new `webhook_failures` table.
- **`supabase/migrations/008_webhook_failures.sql`** — new, isolated table. Enabled RLS
  with no anon/authenticated policies, same deny-by-default posture as every other
  table in `000_baseline.sql` — only `service_role` (used by the Edge Function) can
  read or write it.
- Two new blank-by-default theme settings, same group as the existing `callback_endpoint`
  ("Zo Veilig · Integraties"): `webhook_failure_log_endpoint` and
  `webhook_failure_log_key`. Wired into `window.ZV_WEBHOOK_FAILURE_LOG_ENDPOINT/_KEY` in
  `layout/theme.liquid`, same pattern as `ZV_LEAD_ENDPOINT` itself.

## What it deliberately does NOT do

**It cannot detect a non-2xx response from `ZV_LEAD_ENDPOINT`.** The brief asked for
visibility into "network error, non-2xx response, or timeout." The first and third are
implemented; the second is structurally impossible without a separate, bigger change:
every `ZV_LEAD_ENDPOINT` call uses `mode: 'no-cors'` (needed because that endpoint
doesn't send CORS headers — see the 09-15 diagnosis doc), and a `no-cors` fetch always
resolves to an opaque response. The browser itself cannot read the status code, so no
amount of client-side code — this included — can tell a 200 from a 404 or a 500 apart
from "the browser didn't clearly fail to send it." **What this DOES catch:** the request
never went out at all (DNS failure, connection refused, offline — exactly what actually
happened with the dead Odoo dev database), a client-side timeout (15s, generous
on purpose — see below), or a synchronous exception while building/sending the request.
That covers the failure mode that actually caused the incident this is fixing (dead DNS
is a connection failure, not an HTTP error), but not a "the URL is alive but Odoo
rejected the payload" case.

**Closing that remaining gap means dropping `no-cors` entirely**, which requires the
Odoo endpoint to send proper CORS response headers — a bigger, separate decision
(already flagged as an open option in the 09-15 diagnosis doc's fix recommendation §3),
not made or built here.

**No lead PII is logged.** `webhook_failures` stores only: which form (`source`), the
target hostname (not the full URL — avoids putting the webhook's UUID token in a table
with a different access boundary than the endpoint setting itself), an error type enum,
a truncated error message, and a timestamp. Name/email/phone are never sent to this
table — it's a diagnostic trail, not a second lead record.

**The 15-second client-side timeout is a deliberate, flaggable tradeoff.** Before this
change, a `ZV_LEAD_ENDPOINT` fetch had no timeout at all — it would wait indefinitely
(bounded only by the browser/OS's own network stack), which is more forgiving of a
slow-but-eventually-successful send. Adding *any* timeout means a genuinely slow send
that would have succeeded at, say, 20 seconds now gets aborted and logged as a
"timeout" failure instead. 15 seconds was picked to make that false-positive rare
without leaving a truly hung connection (no DNS response, no TCP reset, nothing) invisible
forever — but it is a real, if narrow, behavior change to the underlying delivery
mechanism, not just a logging addition, so it's called out explicitly rather than
buried in the diff. The customer-facing success/done UI is unaffected either way — it
never depended on this fetch's outcome, before or after this change.

## Manual steps needed before this does anything (nothing is live yet)

This PR ships code only. Until the following happen, `ZV_WEBHOOK_FAILURE_LOG_ENDPOINT`
stays blank in `config/settings_data.json` (not set by this PR — same bootstrap gap
`capture_lead_endpoint` already has, per the 09-15 lead-capture investigation doc) and
`assets/zv-lead-webhook.js`'s `logFailure()` silently no-ops, exactly like today:

1. **Deploy `supabase/functions/log-webhook-failure`** to the DEV Supabase project (same
   project `capture-lead` is meant to be in) and set its `ALLOWED_ORIGINS` secret to the
   `zoveiligdev.myshopify.com` storefront origin(s), same as `capture-lead`'s convention.
2. **Apply `supabase/migrations/008_webhook_failures.sql`** to that project — this is a
   new migration file; whether it needs to be applied manually depends on current DEV
   Supabase access (this repo has no CI wired to run `supabase db push` — see the 09-15
   lead-capture investigation doc, same caveat applies here).
3. **Fill in the two new theme settings** (`webhook_failure_log_endpoint` =
   `https://<project-ref>.supabase.co/functions/v1/log-webhook-failure`,
   `webhook_failure_log_key` = the project's anon key) in the Shopify theme editor,
   under "Zo Veilig · Integraties."
4. Separately, and not part of this PR: get a current, live `callback_endpoint` URL
   (the actual bug from the 09-15 diagnosis) — this feature makes the *next* outage
   visible, it doesn't fix the current one.
