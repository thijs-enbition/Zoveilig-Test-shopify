# Required consent checkbox: camera-hardware + Contact page (2026-09-16)

**Goal**: `sections/camera-hardware.liquid`'s "Neem contact op" form (`#camContact`) and
`sections/contact-page.liquid`'s "Plan een gratis adviesgesprek" form (`#zv-contact-form`)
were the only two lead forms in the theme with no consent checkbox — both had previously
*omitted* the `consent` key entirely, on purpose, pending a product/legal decision (see
`docs/contact-odoo-dual-write-2026-09-16.md`, "Open question 3"). This closes that question
for both forms by adding the same required checkbox already live on
`snippets/zv-callback-form.liquid`, reusing its exact copy:

```
Ik geef toestemming dat Zo Veilig contact met mij opneemt over mijn aanvraag.
```

## What changed

### 1. `sections/camera-hardware.liquid` — "Neem contact op" (`#camContact`)

- Added `<label class="cam-contact-consent"><input type="checkbox" id="ccConsent" required>…</label>`
  after the (optional) e-mail field, before the error banner and submit button — matching
  this form's existing plain-input layout (no `<label for>` wrappers on the other fields).
- New scoped CSS (`.cam-contact-consent`) styled like this form's other elements: flex row,
  18px checkbox with `accent-color: var(--indigo)`, small muted label text — no new global
  classes, nothing borrowed from another section's stylesheet.
- `#camContact`'s submit handler now reads `document.getElementById('ccConsent').checked`,
  blocks with the same `#ccErr` banner already used for missing naam/telefoon ("Geef eerst
  toestemming zodat we contact mogen opnemen.") if unchecked, and adds `consent:true/false`
  to the lead payload sent to `window.ZVLeadWebhook.send(payload, 'camera_hardware')`
  (previously the `consent` key was omitted entirely).

**Note**: this form has no `novalidate` attribute (unlike the reusable callback-form), so the
checkbox's native `required` attribute is the actual, primary block — the browser's own
constraint validation stops submission before the `submit` event ever fires, the same way it
already does for the naam/telefoon inputs. The new `if(!consent){…ccErr…}` JS check is a
defensive mirror of that pattern (matching how naam/telefoon are *also* re-checked in JS after
`.trim()`, catching a whitespace-only edge case native validation can't) — in real browser
testing it never actually fires, because native validation blocks first. Confirmed the native
block message: `"Please check this box if you want to proceed."` (Chromium's default; not
custom copy, same as every other browser-native validation message on this form).

### 2. `sections/contact-page.liquid` — "Plan een gratis adviesgesprek" (`#zv-contact-form`)

- Added a `<div class="fld fld-consent"><label class="cn-consent"><input type="checkbox"
  id="c-consent" required>…</label></div>`, after the "Uw vraag of situatie" textarea and
  before the hidden `Bron` field — reusing the form's own `.fld` wrapper (for the existing
  `fld--invalid` mechanism) with an additional `fld-consent` class for checkbox-specific
  layout, since the generic `.fld input{width:100%}` rule would otherwise stretch the
  checkbox full-width.
- `c-consent` was added to the existing `requiredFields` array. This form *does* have
  `novalidate`, so — unlike camera-hardware — the existing generic client-side `validate()` /
  `clearInvalid()` mechanism is what blocks submission here: an unchecked box gets
  `.fld--invalid` (new CSS added so the label text also turns the same red as other invalid
  fields), and the existing `#cn-err` banner ("Controleer even de gemarkeerde velden en
  probeer het opnieuw.") is shown — the same mechanism already covering Naam/Telefoon/
  E-mailadres, not a new one.
- `payload.consent = !!(consentInput && consentInput.checked)` is now set explicitly (the
  checkbox has no `name` attribute, so `FormData` never picks it up on its own — this avoids
  the checkbox serializing as the string `"on"` instead of a real boolean).
- **Supabase `capture-lead` payload**: now includes `consent: true/false` (previously absent).
- **Odoo dual-write payload** (`sections/contact-page.liquid`'s `buildCallbackLead()` call,
  added earlier today per `docs/contact-odoo-dual-write-2026-09-16.md`): now includes
  `consent: payload.consent` (previously the dual-write's own doc explicitly recorded this as
  "not invented" / omitted, following camera-hardware's prior no-checkbox precedent — that
  precedent no longer holds now that both forms have the checkbox).
- Updated the stale inline comment above the dual-write block that referenced the
  now-resolved "consent open question."

### 3. `supabase/functions/capture-lead/index.ts` — persisting consent server-side

Sending `consent: true` from the browser is not suffient on its own — the Edge Function only
ever writes the fields it explicitly whitelists into the `leads` insert, so an unrecognized
`consent` key would have been silently dropped (same "looks successful, isn't" failure mode
flagged repeatedly in `docs/contact-odoo-dual-write-2026-09-16.md` for `contact_subject`/
`message`). The `leads` table already has `marketing_consent boolean` and
`consent_recorded_at timestamptz` columns (`supabase/migrations/000_baseline.sql`), unused
until now. Added:

```ts
const consent = payload.consent === true;
...
marketing_consent: consent,
consent_recorded_at: consent ? new Date().toISOString() : null,
```

**This function code change has NOT been deployed.** This session has no Supabase CLI
installed and no project credentials (`supabase` command not found; no service-role key or
Personal Access Token available) — deploying requires `supabase functions deploy
capture-lead` against the DEV project (`lfwkpbooieiesuvblvse`, per
`docs/supabase-deploy-2026-09-15.md`). Until that's run, the *committed* function source and
the *live* deployed function disagree: the live one still silently ignores `consent` from the
payload, so a real submission today would send `consent:true` but the `leads` row would still
show `marketing_consent = false` (the column's default). **Someone with Supabase CLI access
needs to run `supabase functions deploy capture-lead` before this is actually live** — flagging
this the same way prior sessions flagged Odoo `record_getter` gaps: sending the field is
necessary but not sufficient.

## Verification

No storefront password was available in this session (same recurring blocker as
`docs/contact-capture-lead-fix-2026-09-16.md` and others — not stored in the repo by design).
Used `shopify theme dev` instead (`http://127.0.0.1:9294`), which proxies the real store
through the authenticated CLI session and bypasses the password wall entirely — confirmed
both `/pages/camera-hardware` and `/pages/contact` render `200` locally. Real Chromium via
Playwright (`headless: true`), `shopify.theme.toml` copied in from the main checkout (per
CLAUDE.md, gitignored, not carried by `git worktree add`).

### camera-hardware "Neem contact op"

- **Unchecked submit**: blocked. `checkValidity()` false; native browser message "Please
  check this box if you want to proceed."; `#ccErr` never shown (native validation intercepts
  first, same as naam/telefoon already do on this form); nothing sent.
- **Checked submit**: real `200` from the live Odoo webhook
  (`https://zoveilig.odoo.com/web/hook/<redacted-token>`), payload confirmed to include
  `"consent":true`:
  ```
  {"lead_type":"camerahardware","source_page":"camera-hardware","name":"Playwright Consent Test CamVerify",
   "phone":"0000000001","email":"playwright-consent-camverify-2026-09-16@example.invalid","consent":true,
   "cta_location":"camera_hardware_page","source":{...}}
  ```

**Pre-existing bug found, unrelated to this task, not fixed here**: `#ccDone` (the "Bedankt,
wij bellen u terug." success message) is nested *inside* `<form id="camContact">`. The success
handler sets `camContact`'s own `style.display='none'` to hide the form — which also hides its
descendant `#ccDone`, since a `display:none` ancestor hides all descendants regardless of
their own `display` value. Confirmed via real browser: after a successful submit,
`getComputedStyle(#ccDone).display` reports `flex` (its own rule was applied) but
Playwright's `isVisible()` correctly reports `false` (nothing is actually rendered, because
the ancestor is hidden) — so the "Bedankt" message has apparently never been visible to a
real visitor since this form shipped. Not touched here (out of scope for a consent-checkbox
task); worth a follow-up ticket — likely fix is moving `#ccDone` to be a sibling of
`#camContact` instead of a child, or swapping which classes get toggled.

### contact-page "Plan een gratis adviesgesprek"

- **Unchecked submit**: blocked. `#cn-err` banner shown ("Controleer even de gemarkeerde
  velden en probeer het opnieuw."), `c-consent`'s `.fld` wrapper got `.fld--invalid`, `#cn-ok`
  stayed hidden, no network request fired (client-side `validate()` returned early).
- **Checked submit — Odoo dual-write**: real `200` from the same live Odoo webhook, payload
  confirmed with `"consent":true`:
  ```
  {"lead_source":"website","lead_type":"contact_page","lead_temperature":"hot",
   "page_url":"http://127.0.0.1:9294/pages/contact","timestamp":"...",
   "cta_location":"contact_page","name":"Playwright Consent Test","phone":"0612345678",
   "email":"playwright-consent-2026-09-16@example.invalid","preferred_callback_time":"any",
   "contact_subject":"advies","message":"","consent":true}
  ```
- **Checked submit — Supabase capture-lead**: the outgoing request body was confirmed to
  include `"consent":true` (captured client-side), but **the actual HTTP response could not be
  observed** — the Edge Function's `ALLOWED_ORIGINS` only allows
  `https://zoveiligdev.myshopify.com`, and `shopify theme dev`'s local proxy serves from
  `http://127.0.0.1:9294`, so the browser's CORS preflight was rejected and the real POST
  never reached the server (confirmed via a `response` listener — no response event fired for
  `capture-lead`, vs. a real `200` observed for the Odoo URL in the same run). This is a
  limitation of testing through the local proxy, not a defect in this change — the same
  request from the real storefront origin would not hit this preflight rejection. **Given
  this session also could not deploy the Edge Function change (§3 above) or query the `leads`
  table directly (no Supabase CLI/credentials), the actual "does `marketing_consent` land as
  `true` in a real Supabase row" question is unverified** and needs a follow-up session (or
  Thijs) with Supabase access, after deploying the function.

### Real leads created during this verification

Testing fired real requests to the **live** Odoo CRM webhook (`window.ZV_LEAD_ENDPOINT` is a
production endpoint, not a sandbox) — four submissions, all obviously marked:
- `Playwright Consent Test` / `Playwright Consent Test CamVerify` /
  `Playwright Consent Test DryRun` / `Playwright Consent Test DryRun2`
- phones `0612345678` / `0000000000` / `0000000001`
- emails ending `@example.invalid` (`playwright-consent-2026-09-16@…`,
  `playwright-consent-camverify-2026-09-16@…`, `playwright-consent-dryrun(2)-2026-09-16@…`)

Same pattern as every prior session's Playwright verification in this repo (e.g.
`docs/contact-odoo-dual-write-2026-09-16.md`) — findable in Odoo CRM by filtering on
`@example.invalid`, safe to delete. No Supabase `leads` rows were created (the Supabase
requests never completed, per above).

## Validation sequence

1. `python3 scripts/check_pricing.py` — all checks pass (unaffected files).
2. `shopify theme check --environment zoveiligdev` — 0 errors theme-wide; 174 pre-existing
   warnings across 22 files (same baseline count as
   `docs/contact-capture-lead-fix-2026-09-16.md`); zero offenses, new or pre-existing, in
   `sections/camera-hardware.liquid` or `sections/contact-page.liquid`.
3. Disposable-theme push against Shopify's real server-side Liquid validator (stricter than
   `theme check`, per this repo's `CLAUDE.md`): `shopify theme push --unpublished --theme
   zz-validate-consent-checkboxes-20260916173933 --only sections/camera-hardware.liquid
   --only sections/contact-page.liquid` → pushed clean, then deleted
   (`#188907323773`).
4. **Not pushed to `origin`** and **not pushed to the live theme** — per the task brief, this
   is new form behavior (a new required field can block a submission that previously
   wouldn't have been blocked) on two pages, not a bugfix, so live/`origin` push is left as
   an explicit decision for Thijs, same treatment as the Odoo dual-write change today.

## What's left for Thijs

1. **Deploy the `capture-lead` Edge Function** (`supabase functions deploy capture-lead`
   against the `lfwkpbooieiesuvblvse` DEV project) so `marketing_consent`/
   `consent_recorded_at` actually start getting written — committed code and live behavior
   disagree until this runs.
2. Once deployed, confirm a real submission from the actual storefront origin shows
   `marketing_consent = true` in the `leads` table (this session couldn't — no DB access).
3. Decide whether/when to push `sections/camera-hardware.liquid` and
   `sections/contact-page.liquid` to `origin main` / the live theme.
4. Delete the four obviously-marked Playwright test leads from Odoo CRM (see list above), or
   confirm they're fine to leave.
5. Optional follow-up, unrelated to consent: fix the pre-existing `#ccDone`-nested-in-hidden-
   form bug in `camera-hardware.liquid` found during this verification.
