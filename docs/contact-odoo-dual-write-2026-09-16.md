# Contact form → Odoo CRM dual-write (2026-09-16)

**Goal**: Contact-page ("Plan een gratis adviesgesprek") leads should land in Odoo CRM, same
pipeline Vista/Veilig Onderweg/camera-hardware already use, in addition to the existing
Supabase `capture-lead` write (not instead of it).

## Step 1 — Investigation

### Current submit handler

Inline in `sections/contact-page.liquid`'s `{% javascript %}` block (lines 136-210). On
submit: client-side required-field validation (Naam/Telefoon/E-mailadres) →
`fetch(capture_lead_endpoint, ...)` with `apikey`/`Authorization` headers → shows `#cn-ok` or
`#cn-err-server` based on the response. This is the only lead pipeline currently wired to this
form — no Odoo call exists yet.

### Exact field names/values (from the live form markup)

| Field | `name` attribute | Values |
|---|---|---|
| Naam | `Naam` | free text, required |
| Telefoon | `Telefoon` | free text (`type="tel"`), required |
| E-mailadres | `email` | free text (`type="email"`), required |
| Onderwerp | `Onderwerp` | `advies`, `langer_thuis`, `mijn_thuis`, `veilig_onderweg`, `zakelijk`, `bestaand_klant` |
| Wanneer belt u het liefst | `Voorkeurstijd` | `any`, `morning`, `afternoon`, `evening` |
| Vraag of situatie (optioneel) | `body` | free text (textarea) |
| (hidden) | `Bron` | always `Contactpagina` — Supabase-only field, not part of the Odoo payload |
| (honeypot) | `website` | empty when legitimate |

### `lead_type` collision check

Existing values in use: `vista` (`sections/oplossingen.liquid`), `onderweg`
(`sections/oplossingen.liquid`, Veilig Onderweg coming-soon form), `camerahardware`
(`sections/camera-hardware.liquid`), `callback_request` (default in
`assets/zv-measurement.js`'s `buildCallbackLead`, used by the reusable "Bel mij terug" form,
`snippets/zv-callback-form.liquid` + `assets/zv-callback.js`).

**`contact_page` does not collide with any of these** — confirmed by grepping every
`lead_type:` literal in the theme. Using `contact_page` as proposed.

### `preferred_callback_time` mismatch — reported, not silently coerced

The reusable callback-form (`snippets/zv-callback-form.liquid`, the one Odoo's pipeline was
built around) uses:

```
zo-snel-mogelijk | ochtend (9-12) | middag (12-17) | avond (17-20)
```

The Contact page's `Voorkeurstijd` uses:

```
any | morning (09:00-12:00) | afternoon (12:00-17:00) | evening (17:00-20:00)
```

**Three of four line up exactly in meaning and time range**: `morning`→`ochtend`,
`afternoon`→`middag`, `evening`→`avond`. These are mapped 1:1 in the implementation below —
same time window, just a different code, no information lost.

**`any` does not have an equivalent.** The closest existing value, `zo-snel-mogelijk`, means
"as soon as possible" (urgency) — `any`/"Maakt niet uit" means "no preference on time of
day" (indifference). These are not the same thing, and coercing `any` → `zo-snel-mogelijk`
would silently misrepresent a visitor who has no time preference as one requesting urgent
callback. **Not coerced.** The implementation sends the literal string `any` through
unmapped when that option is selected — a value Odoo's `preferred_callback_time` field has
never received from any other form. **Flagged for Thijs/Alex**: either (a) Odoo's Automation
Rule should treat an unrecognized `preferred_callback_time` value gracefully (store it as-is,
don't error), or (b) if a true "no preference" value should exist in Odoo's field, tell us
what code to send and it'll be a one-line change here, or (c) if this mismatch should instead
be fixed on the theme side (e.g. add `zo-snel-mogelijk` as this form's own first option
alongside morning/afternoon/evening, matching the callback-form's four options exactly),
that's also a small change — not made here since it changes visible form copy, out of scope
for a backend-wiring task.

## Step 2 — Field mapping proposal

| Contact form field | Odoo/`rec` field | Mapping |
|---|---|---|
| Naam | `name` | direct |
| Telefoon | `phone` | direct |
| E-mailadres | `email` | direct |
| Voorkeurstijd | `preferred_callback_time` | `morning`→`ochtend`, `afternoon`→`middag`, `evening`→`avond`, `any`→`any` (unmapped, see above) |
| Onderwerp | **`contact_subject` (new field)** | direct, unmapped (see below) |
| Vraag of situatie | **`message` (new field)** | direct, unmapped (see below) |
| — | `lead_type` | `'contact_page'` (new value, no collision) |
| — | `cta_location` | `'contact_page'` |
| — | `lead_source`, `lead_temperature`, `page_url`, `timestamp`, attribution fields | from `ZVMeasurement.buildCallbackLead()`, same as every other lead_type — not hand-built |

### Open question 1 — `Onderwerp` → `contact_subject`, needs an Odoo-side check

No existing field is an obvious fit. `solution_category` (used by Vista/the reusable
callback-form) is narrower and differently scoped — it identifies a specific product/package
category (`'security'`, or a package's own category from `zv-callback-form.liquid`'s
`solution_category` param), not a general "what is this contact about" topic. Onderwerp's own
values (`advies`, `langer_thuis`, `mijn_thuis`, `veilig_onderweg`, `zakelijk`,
`bestaand_klant`) mix solution-line names with things that aren't solution categories at all
(`advies`, `zakelijk`, `bestaand_klant`) — forcing it into `solution_category` would be
actively misleading for those three.

**Proposing a new field, `contact_subject`, sent as-is (the raw option value).**
**Flagging explicitly**: this repo has no visibility into the Odoo Automation Rule's
`record_getter` (the Python mapping that turns the incoming webhook JSON into `crm.lead`
fields — that configuration lives entirely inside Odoo, not in this repo). **A field the
`record_getter` doesn't know about is silently dropped, not an error** — same class of
"looks successful, isn't" failure mode as the settings-defaults and CORS bugs fixed earlier
today, just on the Odoo side instead of the theme/Supabase side this time. **Thijs/Alex need
to confirm the Automation Rule's `record_getter` reads `contact_subject`** (and `message`,
below) for this to actually show up on the Lead record — sending it is necessary but not
sufficient.

### Open question 2 — "Vraag of situatie" → `message`, same caveat

No existing lead_type sends any freetext field today (checked every `lead_type:`-carrying
payload in the theme — none has one). Proposing `message` as the field name (plain,
descriptive, no existing convention to conflict with). **Same record_getter caveat as
`contact_subject` above** — needs a matching read on the Odoo side or it's silently dropped.

### Open question 3 — consent: not invented

**This form has no consent checkbox**, unlike the reusable callback-form
(`snippets/zv-callback-form.liquid`, which has a required "Ik geef toestemming..." checkbox
whose state is sent as `consent: true/false`) and unlike Vista's inline form (also has a
`consent` checkbox). Not sending an invented `consent: true` here — that would fabricate a
compliance signal that was never actually collected from this visitor.

**Not sending `consent: 'not_collected'` either, on reflection** — there is already a clean
precedent for this exact situation in production: `camera-hardware.liquid`'s "Neem contact
op" form (also `lead_type: 'camerahardware'`, live today) has no consent checkbox either, and
its payload simply **omits the `consent` key entirely** rather than sending a placeholder.
Following that same precedent here for consistency: **the `consent` field is omitted from
this form's payload**, not set to any value. Flagging this as the same category of open
compliance question as the existing camera-hardware one (not a new, unrelated question —
whether either of these forms *should* have a consent checkbox is a product/legal decision
for Thijs, not something to guess at here).

## Step 3 — Implementation

`sections/contact-page.liquid`'s submit handler: right after client-side validation passes
(same point the Supabase `fetch` already fires from) and *before* that `fetch` call, build
and fire the Odoo lead independently — no promise chaining, no waiting on the Supabase
response, wrapped so it can never throw into or block the existing flow:

```js
var TIJD_MAP = { morning: 'ochtend', afternoon: 'middag', evening: 'avond' }; // 'any' has no Odoo equivalent — see docs/contact-odoo-dual-write-2026-09-16.md
try {
  if (window.ZVMeasurement && window.ZVMeasurement.buildCallbackLead && window.ZVLeadWebhook) {
    var tijd = payload.Voorkeurstijd || '';
    var rec = window.ZVMeasurement.buildCallbackLead({
      lead_type: 'contact_page',
      cta_location: 'contact_page',
      name: payload.Naam || '',
      phone: payload.Telefoon || '',
      email: payload.email || '',
      preferred_callback_time: TIJD_MAP[tijd] || tijd,
      contact_subject: payload.Onderwerp || '',
      message: payload.body || ''
    });
    window.ZVLeadWebhook.send(rec, 'contact_page');
  }
} catch (e) { /* never block the Supabase submit on this */ }
```

The existing Supabase `capture-lead` call is untouched — both writes now fire independently
from the same successful-validation point. Contact leads exist in both systems from now on.

`window.ZV_LEAD_ENDPOINT` (the Odoo webhook) and `zv-measurement.js`/`zv-lead-webhook.js` are
already loaded globally in `layout/theme.liquid` — no new theme setting, no new script tag,
nothing to wire beyond this one block.

**`log-webhook-failure`'s `SOURCE_CODES` gap, noticed in passing**:
`supabase/functions/log-webhook-failure/index.ts` validates `source` against
`["vista", "camera_hardware", "onderweg_coming_soon"]` — `'contact_page'` (the second
argument to `ZVLeadWebhook.send`) isn't in that list. This only affects the *best-effort
failure-logging* path (per `assets/zv-lead-webhook.js`'s own docstring, logging is silent and
best-effort by design) — if a `contact_page` send ever fails, `log-webhook-failure` would
reject the log attempt with `400 invalid_fields` instead of recording it, the same way it
would for a source it doesn't recognize. The lead-send itself is unaffected. Not fixed here
(out of scope for this task, and `log-webhook-failure`'s validation is deliberately a fixed
allow-list) — worth a one-line addition to that list in a follow-up if `contact_page`
failure visibility turns out to matter.

## Step 4 — Real-browser verification

**Update: this section describes the initial preview-theme verification. See "Live deploy"
below for the subsequent push to the actual published theme and its own re-verification —
this is now live, not just previewed.**

Initially **not tested on the actual published live theme** (`#188704719229`) — unlike the two prior
fixes today, this task didn't include an explicit "push this to the live theme" step, and
when this session tried the same scoped `--allow-live` push used for those earlier fixes,
Claude Code's auto-mode classifier denied it outright as **"Production Deploy"** (a stricter
gate than the "Out-of-Place Publication"/"Credential Leakage" denials seen earlier today,
which a direct "please push" from Thijs was enough to clear — this one wasn't attempted a
second time, since a hard "Production Deploy" denial reads as a deliberate gate on shipping
new *behavior* to production, not the same class of transient/content-trigger block as those
others). Rather than guess whether this task intended a live push or push around the
classifier, **verified against a full unpublished preview theme instead**
(`zv-preview-contact-odoo-20260916170520`, id `188906242429`, `shopify theme push
--unpublished`, since the current working tree's changes) — real Shopify storefront
infrastructure, same domain, same password gate, same JS/CSS pipeline, just not the
published theme. **If Thijs wants this live, it needs the same scoped `--allow-live` push
the last two fixes used — flagging that as a decision for Thijs, not assuming it.** The
preview theme was deleted after verification (not left running — nothing in this task asked
for a click-through hand-off the way the 2026-09-15 Supabase-deploy session's preview theme
did).

Before pushing even the preview theme, diffed the live theme's actual current
`sections/contact-page.liquid` against this branch's pre-change version — **zero difference
beyond this change itself**, confirming no undocumented live-editor drift existed to worry
about.

**Method**: Playwright, real Chromium (`headless: false`), storefront password →
`/pages/contact?preview_theme_id=188906242429` → forced cache-bypassing reload → fill
Naam/Telefoon/E-mailadres/Onderwerp/Voorkeurstijd/body with an obviously-marked test entry →
submit → capture console, and network activity for both the Odoo host (`zoveilig.odoo.com`)
and the Supabase host, with timestamps.

**Console: no errors from this change.** Only pre-existing, unrelated lines (the same
password-form accessibility notice and early 404 seen in earlier sessions' tests, plus
`[HotReload]`/`[bugsnag]` debug lines that only appear because this is an unpublished preview
theme — Shopify injects its own dev-mode scripts there, not present on the published theme).

**Odoo request fired, real `200` response** (Playwright's network inspection sees the actual
HTTP transaction even though the page's own JS gets an opaque `no-cors` response — same
structural limit `assets/zv-lead-webhook.js`'s docstring already describes, expected and
fine, same as Vista/Onderweg today):

```
POST https://zoveilig.odoo.com/web/hook/<redacted-token> → 200
{"lead_source":"website","lead_type":"contact_page","lead_temperature":"hot",
 "page_url":"https://zoveiligdev.myshopify.com/pages/contact",
 "timestamp":"2026-09-16T15:07:09.564Z","cta_location":"contact_page",
 "name":"Playwright Odoo Test","phone":"0612345678",
 "email":"playwright-odoo-dual-write-2026-09-16@example.invalid",
 "preferred_callback_time":"middag","contact_subject":"langer_thuis",
 "message":"Playwright dual-write verification — verwijderen."}
```

Confirms the field mapping works exactly as designed: `afternoon` → `middag` (not
raw-passed), `contact_subject`/`message` present with the raw form values, **no `consent`
key at all** (confirmed omitted, not sent as any placeholder), `lead_type`/`cta_location`
both `contact_page` as proposed, and the full `buildCallbackLead()` envelope
(`lead_source`/`lead_temperature`/`page_url`/`timestamp`) present exactly like every other
lead_type gets.

One benign artifact, noted for completeness: immediately after the `200` response, Playwright
also logged a `requestfailed`/`net::ERR_ABORTED` event for the same Odoo URL. The `200`
response had already landed by then — this reads as `ZVLeadWebhook.send`'s own
`AbortController`/timeout cleanup racing the already-resolved fetch at the network-events
level, not a real failure (the response body/status were already captured). Not investigated
further since the request demonstrably succeeded.

**Supabase `capture-lead` fired independently and also succeeded** — confirms this really is
additive, not a regression on the existing path:

```
POST https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/capture-lead → 200
{"ok":true,"lead_reference":"LEAD-20260916-3B0C3E"}
```

**DOM: `#cn-ok` visible, `#cn-err-server` and `#cn-err` both not visible** — checked
programmatically, not inferred.

**Odoo CRM itself was not checked** — this session has no Odoo login/API credentials (true in
every prior session that touched this pipeline too, per
`docs/callback-endpoint-live-2026-09-15.md` and `docs/odoo-webhook-fix-2026-09-15.md`). The
`200` response confirms the webhook accepted the request; it does not by itself confirm a
`crm.lead` record was actually created with the right fields (that's exactly Open Questions 1
and 2 above — a field the `record_getter` doesn't map is silently dropped, and a silent drop
still returns `200`). **Thijs/Alex: please check Odoo CRM for a Lead named "Playwright Odoo
Test" / `playwright-odoo-dual-write-2026-09-16@example.invalid`, confirm it exists, and
confirm `contact_subject`/`message` actually landed on it** (not just name/phone/email) — that
second part specifically needs your eyes, since a `200` can't distinguish "mapped correctly"
from "silently dropped two fields."

## Live deploy (after this doc's first draft — pushed on Thijs's explicit instruction)

Thijs explicitly instructed the exact scoped push the auto-mode classifier had denied
earlier: `shopify theme push --theme 188704719229 --only sections/contact-page.liquid
--nodelete --allow-live`. Ran it — succeeded this time (the classifier denial was specific to
that one attempt, not a standing block; re-running the identical command after explicit
instruction is the same pattern as the "Credential Leakage"/"Out-of-Place Publication"
denials earlier today, all cleared the same way). **Verified after, independently**:
re-pulled the live file fresh and diffed it against the exact file just pushed — zero
difference.

**Re-ran the real-browser verification against the actual published live page this time**
(`https://zoveiligdev.myshopify.com/pages/contact`, no `preview_theme_id`), same Playwright
method, a second, distinctly-marked test entry (`"Playwright Odoo Test LIVE"` /
`playwright-odoo-dual-write-LIVE-2026-09-16@example.invalid`) so it's not confused with the
preview-theme test above:

- **Console: clean** — only the two pre-existing, unrelated lines seen in every prior test on
  this page (password-form accessibility notice, early unexplained 404). No `[HotReload]`/
  `[bugsnag]` noise this time, confirming those were specific to the now-deleted preview
  theme, not this change.
- **Odoo**: `POST https://zoveilig.odoo.com/web/hook/<redacted-token>` →
  real `200`, same correctly-mapped payload shape as the preview-theme test
  (`preferred_callback_time: "middag"`, `contact_subject`, `message`, no `consent` key).
- **Supabase**: `capture-lead` → real `200`, `{"ok":true,"lead_reference":"LEAD-20260916-BF3293"}`
  — independent write still succeeds, unaffected by the Odoo addition.
- **DOM**: `#cn-ok` visible, `#cn-err-server`/`#cn-err` both not visible.

**This is now live and confirmed working end-to-end on the actual published Contact page**,
not just a preview. The one thing still open is the same as above: Odoo CRM itself wasn't
checked (no credentials in this session) — two obviously-marked test Leads now exist from
this task and should both be findable by filtering on `@example.invalid`:
`playwright-odoo-dual-write-2026-09-16@example.invalid` (preview-theme test) and
`playwright-odoo-dual-write-LIVE-2026-09-16@example.invalid` (live test, above). Please check
both landed with `contact_subject`/`message` populated, and delete them once confirmed.

## Step 5 — Wider note: ADR-004 deviation, not new

Vista/Veilig Onderweg/camera-hardware already send directly to Odoo CRM despite ADR-004
("Odoo deferred to Phase 2" — *"No Odoo dependency in Phase 1"*,
`docs/architecture/adr/ADR-004-odoo-deferred-phase-2.md`). This change extends that same
already-established, informal deviation to a fourth form — it doesn't introduce a new one.
Worth a proper ADR update at some point (the decision record no longer matches what's
actually shipped), but that's a documentation/governance task, not a blocker for this one.
