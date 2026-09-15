# `callback_endpoint` (ZV_LEAD_ENDPOINT) pointed at the new Odoo webhook (2026-09-15)

**Status: live theme patched and verified. Smoke test blocked (storefront password).
Odoo-side test-record cleanup not confirmed — flagged below, not silently skipped.**

## Endpoint change

| | Host (path/token redacted) |
|---|---|
| Old (dead, Veronica's Odoo.sh dev DB) | `zoveilig-2026-06-15-36420254.dev.odoo.com` |
| New (production Odoo, this session's Automation Rule) | `zoveilig.odoo.com` |

Full URLs (including the webhook secret token) are in `config/settings_data.json` on the
live theme and in this session's transcript — not repeated here since this doc may be read
more widely than the transcript.

## Pre-check: is the endpoint actually working right now?

**Confirmed yes, immediately before patching** — this session found the new webhook
flipping between working and failing unconditionally several times today (documented in
chat, not yet explained on the Odoo side). A fresh POST with a full Vista-shaped payload
(`"Wiring pre-check — verwijderen"`) returned `200` right before the live patch below, so
the value being wired in is the confirmed-working one at time of writing. **This
intermittency is still unresolved and worth chasing down independently of this task** — a
webhook that sometimes 500s unconditionally is a real risk for production lead capture,
same class of problem as the original silent-failure investigation that started all of
this.

## Live theme patch — same pattern as this morning, verified the same way

1. Pulled `Zoveilig-Test-shopify/main` (`#188704719229`)'s actual live
   `config/settings_data.json` fresh.
2. **Diffed it against this repo's git-tracked copy first: zero difference.** Unlike this
   morning, git's `settings_data.json` now already carries the `capture_lead_endpoint`/
   `_anon_key`/`webhook_failure_log_endpoint`/`_key` values too (committed at some point
   today) — live and git agreed exactly, so there was no undocumented drift to reconcile,
   and nothing about that agreement needed reconciling before proceeding.
3. Patched **only** `callback_endpoint`, one line, confirmed via diff before pushing:
   ```
   -      "callback_endpoint": "https://zoveilig-2026-06-15-36420254.dev.odoo.com/web/hook/...",
   +      "callback_endpoint": "https://zoveilig.odoo.com/web/hook/...",
   ```
   Validated the result still parses as JSON with the same 118 preset keys (117 others
   untouched).
4. Pushed scoped to that single file (`--only config/settings_data.json --nodelete
   --allow-live`, the last flag required for a non-interactive live-theme push).
5. **Verified after, independently**: pulled the live file again and diffed it against the
   exact file just pushed — **zero difference**. Separately diffed post-push against
   pre-push — **only `callback_endpoint` changed**, same verification pattern as this
   morning's Supabase settings promotion.

`webhook_failure_log_endpoint`/`_key` and `capture_lead_endpoint`/`_anon_key` were not
touched, per the brief — already live from this morning. `sections/oplossingen.liquid`,
`sections/camera-hardware.liquid`, and Odoo's Target Record configuration were not touched
either — already aligned and confirmed working per the prior session's field-alignment fix
and this session's isolation tests.

## Smoke test — blocked, same reason as this morning

**Could not submit through the three live forms.** No browser tool is available in this
session, and `https://zoveiligdev.myshopify.com/pages/contact`-style storefront URLs still
302-redirect to `/password` regardless of theme settings — confirmed again just before
writing this doc. I have no storefront password. This is the same blocker as this
morning's Contact-form smoke test, not a new one.

**What to check yourself:**
1. Enter the storefront password, then try Vista's callback form (Oplossingen page),
   Veilig Onderweg's "Blijf op de hoogte" coming-soon form, and camera-hardware's "Neem
   contact op" form, each with an obviously test-marked entry.
2. Confirm each shows its normal success/done state (no error).
3. Confirm three distinct Leads appear in Odoo CRM, each with the right `lead_type`-driven
   naming/tagging (`vista`, `onderweg`, `camerahardware`) — this is the first real
   confirmation that the live-wired forms, not just direct curl calls to the webhook,
   actually produce correct records end-to-end.

## Odoo-side test-lead cleanup — NOT confirmed, needs your action

**I do not have Odoo CRM access (no browser tool, no Odoo API credentials in this
session)**, so I cannot confirm whether earlier "Test Lead — verwijderen" records were
deleted, and did not silently assume they were. Every test send from this session that got
a `200`/`201` back (i.e., every one of these should have actually created a Lead) used one
of these names — all obviously marked, all safe to delete:

- `"Test Lead — verwijderen"` (multiple times, plain and with `"(stability check)"`)
- `"Test Lead — verwijderen (vista)"`
- A `lead_type: "onderweg"` test send with no name field (this form doesn't collect one) —
  look for `test@example.invalid` with no name, or whatever Odoo defaulted the
  title/contact to
- `"Test Lead — verwijderen (camerahardware)"`
- `"Wiring pre-check — verwijderen"` (from the pre-check just above, immediately before
  this patch)

Every one of these used `email: test@example.invalid` — filtering Odoo CRM by that email
should surface all of them in one place. Please delete them (or tell me once done — I have
no way to verify this myself either way).
