# New Odoo webhook for ZV_LEAD_ENDPOINT (2026-09-15)

**Status: blocked at Part 1's own isolation-test gate. No theme code touched.**

The old `callback_endpoint` (`zoveilig-2026-06-15-36420254.dev.odoo.com`, Veronica's
Odoo.sh dev database) is confirmed dead and unrecoverable — see
`docs/lead-endpoint-diagnosis-2026-09-15.md`. This session's brief was to set up a new
webhook in the real production Odoo instance (`zoveilig.odoo.com`) and wire it in. Part 1
required navigating Odoo's admin UI to create the Automation Rule; **no browser/device
tool was available in this session** (checked via tool search for browser, Chrome,
device-control, computer-use, Puppeteer/Playwright/CDP tooling — none found), so Thijs did
that step himself and provided the resulting webhook URL.

## What was tested

**Step 0 (browser check): confirmed no browser tool available — reported back, did not
guess at Odoo's UI, matching the brief's own instruction.**

**Step 6 (isolation test before touching any theme code) — this is where it stopped.**

Webhook URL: `https://zoveilig.odoo.com/web/hook/1853cc7e-c159-41ef-8bfa-72376cdc246d`
(real production Odoo, `server: Odoo.sh` confirmed in every response header — this is not
a dead/unreachable endpoint like the old one).

Four requests sent, all with an obviously test-marked payload
(`"Test Lead — verwijderen"` / `test@example.invalid`) where a payload was sent at all:

| # | Request | Result |
|---|---|---|
| 1 | `POST` with `{name, email, phone, message, source}` (the field names Thijs gave as the expected shape) | `500 {"status": "error"}` |
| 2 | `POST` with `{name, contact_name, email_from, phone, description, source}` — `crm.lead`'s actual field technical names (`contact_name`/`email_from`/`description`, not the generic `email`/`message`) | `500 {"status": "error"}`, **byte-identical** response |
| 3 | `POST` with `{}` (empty object) | `500 {"status": "error"}`, same |
| 4 | `GET`, no body | `500 {"status": "error"}`, same |

**All four returned the exact same error** (`content-length: 19`, identical body). Getting
the identical error on a bare `GET` with no body at all is the key signal: **this failure
has nothing to do with payload shape or field names** — the endpoint is erroring
unconditionally, before (or without ever) looking at what's sent. That rules out the
"field mapping doesn't match" hypothesis I tried first (attempt #2) — two completely
different field-name sets produced identical errors, which wouldn't happen if the rule
were simply reading the wrong keys and failing on a missing-required-field validation
(that would more likely vary by which fields were present, or at least differ between an
empty body and a full one).

**No Lead was created in Odoo CRM by any of these** (as far as I can tell externally — I
have no way to check the CRM list itself without browser/admin access; Thijs, please
confirm nothing unexpected landed there either, given the automation errored every time).

## What this points to (not confirmed — needs Odoo-side visibility I don't have)

Most likely causes for an *unconditional* 500, roughly in order of likelihood:
1. **The Automation Rule itself has a configuration error** — e.g., a server action /
   Python expression inside the rule that throws regardless of input (a typo in a field
   reference, a broken domain condition evaluated before the payload is even parsed).
2. **The rule isn't actually active**, or the webhook route exists but isn't correctly
   bound to a working rule (some "On Webhook" implementations return a generic error
   response if the target automation was disabled or deleted after the URL was generated).
3. Less likely given the generic wording, but possible: an auth/permission problem on the
   record creation itself (e.g., the automation running as a user without create rights on
   `crm.lead`), which Odoo could also surface as a bare `{"status": "error"}` rather than a
   detailed message depending on how the webhook controller wraps exceptions.

**This needs checking from inside Odoo, which only Thijs can do right now:**
- Settings → Technical → Logging (or the server log / Automation Rule's own execution
  history, if the version in use exposes one) for the actual Python traceback behind these
  four requests — the real error message is almost certainly more specific than
  `{"status": "error"}` and would point straight at the fix.
- Confirm the Automation Rule shows as active/published, and that "On Webhook" is
  genuinely the trigger type selected (not e.g. "On Save" with the webhook token generated
  but the rule's actual trigger left on something else).
- If there's a server action or Python code step inside the rule, check it directly for
  syntax/reference errors.

## What was NOT done (deliberately, per the brief's own gate)

- **No theme code was touched.** The brief was explicit: confirm a Lead appears correctly
  in Odoo before touching `callback_endpoint`, the payload shape, or any theme setting.
  That gate wasn't passed, so `layout/theme.liquid`, `sections/oplossingen.liquid`,
  `sections/camera-hardware.liquid`, and `config/settings_schema.json`/`settings_data.json`
  are all unchanged in this branch.
- **`log-webhook-failure` was not re-tested against this endpoint's real failure modes**
  (the brief's Part 2 step 5) — there's no point testing against an endpoint that's
  currently down for every request; that's worth doing once Part 1 is actually confirmed
  working, not before.
- No `check_pricing.py` / `shopify theme check` / disposable-theme validation was run —
  nothing Liquid-related changed, so there's nothing to validate yet.

## Next step

Once Thijs finds and fixes whatever's causing the unconditional 500 (or gets a fresh
webhook URL from a corrected rule), the fastest way to pick this back up is to re-run
attempt #1's exact payload against the corrected endpoint — if that comes back `200`/`201`
with a real Lead in CRM, Part 2 (theme wiring: new `callback_endpoint` value, a new theme
setting for any auth token if Odoo turns out to need one beyond the URL's own secret token,
aligning the JS payload field names to whatever the corrected rule actually expects,
dig/curl reachability validation, and testing all three forms) can start immediately.
