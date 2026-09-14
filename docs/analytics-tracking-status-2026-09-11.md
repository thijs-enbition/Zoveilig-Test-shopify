# Analytics / conversion tracking — status audit (2026-09-11)

**Why this exists:** Veronica Brits described a "Conversion Taxonomy" setup in an email on
2026-08-17, the day before she went on extended leave. It has not been touched or verified
since, and nobody currently owns this workstream. This is a read-only audit of what her
description actually corresponds to in this repo today, checked directly against the code
(all branches), not against memory of the email. No code was changed as part of this audit.

Related existing docs found during the audit (not written by this audit, but load-bearing
context): [`docs/tracking/README.md`](tracking/README.md) (the target design) and
[`docs/architecture/adr/ADR-010-journey-id.md`](architecture/adr/ADR-010-journey-id.md)
(the journey_id decision, accepted 2026-07-29 — three weeks before her email).

## Claim-by-claim

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | GTM container loaded, Consent Mode v2 (default denied → updated) | **CONFIRMED IN REPO** | [`layout/theme.liquid:4-27`](../layout/theme.liquid#L4-L27) — `gtag('consent','default',{...denied...})` runs before the GTM loader (`GTM-MBDQWPCG`); [`assets/zv-track.js:27-61`](../assets/zv-track.js#L27-L61) — reads Shopify's Customer Privacy API and calls `gtag('consent','update',...)` on `visitorConsentCollected`. Whether the GTM container's *internal* tags/triggers/variables are actually configured to match is invisible from the repo (see "what to check next"). |
| 2 | GA4, Google Ads, Meta all fire through GTM — no hardcoded pixels | **CONFIRMED IN REPO** | Repo-wide grep (all branches) for `G-[A-Z0-9]+`, `AW-[0-9]+`, `fbq(`, `connect.facebook.net` — zero hits outside the GTM snippet itself. Every `dataLayer.push` call in the repo funnels through `assets/zv-measurement.js`'s `push()`/`pushEcommerce()` helpers (lines 136-141, 191-197) — there is no second, ad-hoc push path. `config/settings_data.json` only has an empty, unrelated `social_facebook_link` field. Cannot verify GTM's internal tag config actually forwards to GA4/Ads/Meta — that's inside the container. |
| 3 | No personal data pushed to the dataLayer | **CONFIRMED IN REPO** | `assets/zv-measurement.js:1-20,264-277` — raw email/phone/name are explicitly kept out of `push()`/`pushEcommerce()` calls; email is SHA-256 hashed (Web Crypto) before any use, and the hasher fails closed (returns `null`) rather than falling back to plaintext on an insecure context. `assets/zv-callback.js:8-11,29` — callback lead's name/phone/email go only to the CRM POST body, never to `ZV.push`. No code path was found pushing an email/phone/name field to `dataLayer`. |
| 4 | E-commerce funnel `view_item > add_to_cart > begin_checkout` instrumented | **CONFIRMED WITH A NAMING GAP** | `add_to_cart` (`sections/oplossingen.liquid:935`, `assets/zv-vergelijk-pakketten.js:163`) and `begin_checkout` (`assets/zv-track.js:139`, fired on any checkout-shaped click) both exist and use standard GA4 event names. But **there is no literal `view_item` event anywhere in the repo.** The closest equivalents are `view_item_list` (`assets/oplossingen.js:30,56`) and a non-standard `view_package` (`assets/zv-measurement.js:211`, fired from `assets/oplossingen.js:66`). If GTM/GA4 triggers are wired to listen for the literal string `view_item`, they will never fire from this theme — flag this for the GTM trigger check. |
| 5 | Lead form submissions and the pakket-matcher (keuzehulp) push events | **MOSTLY CONFIRMED — one form is a confirmed exception** | Contact page: `lead_form_start`/`contact_submit` (`assets/zv-track.js:104-116`, relies on Shopify's `?contact_posted=true` redirect param). Callback ("Bel mij terug") form: `callback_cta_click`/`lead_form_start`/`lead_form_submit`/`callback_request`/`error_event` (`assets/zv-callback.js`, `assets/zv-measurement.js:254-259`). Product Finder: `finder_start`/`finder_answer`/`finder_complete`/`finder_restart` (`assets/zv-finder.js:194,240,242,263`). Pakket-matcher (Vergelijk pakketten + shared Langer Thuis panel on Oplossingen): fires `add_to_cart` on its own add-button (`assets/zv-vergelijk-pakketten.js:163`) — but the *recommendation itself* (card selection scoring) pushes no event of its own, only the resulting cart action does. **The Vista lead form is the confirmed exception — see claim 7.** |
| 6 | Purchase fires server-side via Shopify's native pixel so GTM/GA4 can't double-count | **INTENT CONFIRMED IN REPO / ACTUAL BEHAVIOUR CANNOT BE VERIFIED FROM REPO** | `assets/zv-track.js:15` states outright: *"Purchase is intentionally NOT handled here (Shopify pixel + server-side own it)."* Repo-wide grep found no client-side `purchase` event push, no `checkout.liquid`, no `additional_scripts`, no order-status/thank-you page script — so nothing in the theme code itself would double-fire a purchase event. Whether Shopify's native Purchase web pixel is actually enabled and firing server-side (Settings → Customer events in Shopify admin) is outside the repo and unverifiable from here. |
| 7a | Vista lead form doesn't fire a conversion event yet | **STILL OPEN, CONFIRMED** | `sections/oplossingen.liquid:1391-1426` — the Vista form's `submitLead()` only does `fetch(window.ZV_LEAD_ENDPOINT, ...)` and writes to `localStorage['zv_leads']`. It never calls `ZV.push`, `ZV.callbackRequestSuccess`, or anything else that reaches `dataLayer`. No `generate_lead`/`lead_form_submit`-equivalent event exists for this form at all. |
| 7b | No journey_id exists to tie a web session to its Odoo lead | **SCHEMA EXISTS, NOTHING POPULATES IT — effectively still open** | `supabase/migrations/001_leads_journey_attribution.sql` adds a `journey_id text` column with a partial-unique index, and `ADR-010-journey-id.md` (accepted 2026-07-29, *before* her email) describes the intended design: generated on first interaction, carried into cart/order attributes. But `git grep -n "journey_id"` across every branch finds it **only in SQL** — no JS, Liquid or TypeScript anywhere generates, reads, or writes a `journey_id`. `docs/tracking/README.md`'s step "write click identifiers to Shopify cart and order note attributes" is also unimplemented — the only cart attributes ever written are `av_akkoord`/`av_akkoord_tijdstip` (checkout consent) and addon toggles (`sections/oplossingen.liquid:1096`). So: the slot for it exists, but no session is ever actually correlated today. |
| 7c | gbraid/wbraid attribution and the keuzehulp payload need enriching | **STILL OPEN, CONFIRMED** | Repo-wide grep (all branches) for `gbraid`/`wbraid` — zero hits. `assets/zv-measurement.js:102` (`ATTR_FIELDS`) only captures `gclid, fbclid, utm_source, utm_medium, utm_campaign, utm_content, utm_term` — no gbraid/wbraid. Keuzehulp payloads are still thin: `finder_complete` pushes only `{ recommended_pakket, segment }` (`assets/zv-finder.js:194`); the pakket-matcher's `add_to_cart` (`assets/zv-vergelijk-pakketten.js:163`) passes `item_id/item_name/item_brand/quantity` but **no `price`**, so its GA4 value is always unset. Neither path attaches `gclid`/`fbclid`/`utm_*` even though that data is already sitting in `localStorage` via `ZV.getAttribution()`. |

## The add_to_cart price bug — stated plainly

**It is still using the live cart price, not the static `zv_<pkg>_monthly` value. It has not
been fixed here.**

`sections/oplossingen.liquid:935`:
```js
if (ZV && ZV.addToCart) ZV.addToCart({
  item_id: (line && line.sku) || (properties && properties['SKU']),
  item_name: properties && properties['Pakket'],
  item_brand: 'Zo Veilig',
  price: (line && line.price) ? line.price / 100 : undefined,   // ← live /cart/add.js response price
  quantity: 1
}, { cta_location: ... });
```

`line` is the just-added package line item as returned live by `/cart/add.js` — i.e. whatever
Shopify actually charged for that line at that moment. This is the exact same category of bug
that was already found and fixed on the cart page and Overzicht page (commit `bcdb30a`,
*"Cart/Overzicht: source recurring monthly price from confirmed pricing config, not live cart
price"*) — but that fix only touched the customer-facing price labels in `zv-cart.liquid` /
`zv-checkout-overview.liquid`. It did not touch this analytics call site.

The confirmed static monthly values are already computed and sitting in scope in this exact
file — `zv_inzicht_monthly`, `zv_zeker_monthly`, `zv_beschermd_monthly` are injected at
`sections/oplossingen.liquid:232-234` (via `{%- include 'zv-pricing' -%}` at line 32) — they are
simply not the value used for the `add_to_cart` event's `price` field.

**Why this matters concretely:** once the intro-promo (`zv_promo_live`) goes live, the live
`/cart/add.js` line price will reflect a discounted first-period rate, not the ongoing monthly
value. This event would then report the *promotional* price as the item's value to GA4/Google
Ads/Meta, understating true recurring conversion value the same way the cart-page display bug
did before it was fixed — except here nothing will catch it, since this call site isn't covered
by `scripts/check_pricing.py` (that check only validates rendered price *text*, not JS analytics
payloads).

Separately, the pakket-matcher's own `add_to_cart` push
(`assets/zv-vergelijk-pakketten.js:163`) doesn't pass a `price` at all — its GA4 value is
always `undefined`, a different but related gap.

(Note, unrelated to the above but found while re-checking this file: `assets/oplossingen.js:74-97`
contains a second, older `add_to_cart` click handler that listens for `[data-zv-add-to-cart]`.
The current markup uses `data-zv-add`, not `data-zv-add-to-cart` — `sections/oplossingen.liquid:208`
— so this older handler is dead code today and does not double-fire. Worth deleting when someone
next touches this file, but it is not currently a live risk.)

## Lead-source labeling (Robi's ask) vs. what the schema/Edge Function support today

**The schema already supports it. Nothing populates it yet, and there are two disconnected
lead-capture paths, which makes this a bigger gap than "just wire up one field."**

- `public.leads.source` (`supabase/migrations/000_baseline.sql:51`) is a plain `text` column with
  **no CHECK constraint** — it can already hold a detailed label like *"ZV website Vista
  interesse"* today, no migration needed.
- The same baseline migration already has `utm_source`, `utm_medium`, `utm_campaign`,
  `utm_content`, `utm_term`, `gclid`, `fbclid` columns, and migration `001` adds `journey_id`.
  All the columns Robi/attribution work would need already exist.
- But there are **two separate, non-unified lead-capture pipelines**, and only one of them
  reaches the table with those columns:
  1. **Supabase `capture-lead` Edge Function** (`supabase/functions/capture-lead/index.ts`,
     on `feature/contact-form-odoo`) — wired to *only* the Contact page's advice form
     (`sections/contact-page.liquid`). It reads `Naam, Telefoon, email, Onderwerp, Voorkeurstijd,
     body, website (honeypot), Bron` from the POST payload and writes to `public.leads`. It
     **never reads or inserts `utm_*`, `gclid`, `fbclid`, or `journey_id`** — those fields are
     silently left `null` even though the columns exist. The form's own JS
     (`sections/contact-page.liquid:139-151`) builds its payload from plain `FormData`, so it
     never attaches attribution either — the gap is end-to-end on this path, not just in the
     function. And `Bron` is hardcoded to the static string `"Contactpagina"`
     (`sections/contact-page.liquid:58`), with `"Contactpagina"` as the function's own fallback
     default — no page/form-level detail is sent today, even though the column could hold it.
  2. **The generic Odoo webhook** (`window.ZV_LEAD_ENDPOINT`, a theme setting
     `settings.callback_endpoint`, `layout/theme.liquid:85`) — used by the callback ("Bel mij
     terug") form, the Vista lead form, the Veilig Onderweg "coming soon" form, and the
     camera-hardware page's callback. This path **bypasses the Supabase `leads` table
     entirely** — it POSTs straight to Odoo. The callback form's payload (built via
     `ZV.buildCallbackLead`, `assets/zv-measurement.js:265-277`) *does* already merge in
     `gclid`/`fbclid`/`utm_*` from `localStorage`. But Vista's own payload
     (`sections/oplossingen.liquid:1416-1420`) is built by hand and does **not** call
     `buildCallbackLead` — so Vista leads carry no attribution at all, on top of firing no
     tracking event (claim 7a).

**Bottom line:** a detailed source label and full UTM/gclid/journey_id enrichment are both
already schema-supported, and the raw attribution data is already sitting in the browser
(`ZV.getAttribution()`), but no current code path connects "detailed label + attribution" to
"a row in `public.leads`." Closing Robi's request means both wiring a real `Bron`/`source`
value per form/page and deciding whether the Odoo-webhook path and the Supabase `leads` path
should be unified, since today a Vista or callback lead never reaches the table that has the
richer columns at all.

## What this audit could not check (needs a human with GTM/GA4/Ads/Meta/Shopify admin access)

- **GTM container internals** — whether `GTM-MBDQWPCG` actually has GA4, Google Ads, and Meta
  tags configured, and whether their triggers match the event names this repo actually fires
  (in particular: does anything listen for `view_item` — it doesn't exist here, only
  `view_item_list`/`view_package` do).
- **GA4 property config** — whether Enhanced Ecommerce / recommended events are mapped to this
  repo's actual event names, and whether the missing `price` on the pakket-matcher's
  `add_to_cart` shows up as `$0` or unset conversion value in GA4 reporting.
- **Google Ads / Meta account linkage inside GTM** — conversion actions, audiences, and whether
  Enhanced Conversions for Leads is configured as documented in `docs/tracking/README.md`'s
  "Open" section (blocked pending Odoo's treatment of the 1.5x prepayment).
- **Shopify Settings → Customer events** — confirm the native Shopify Purchase web pixel is
  actually enabled and firing server-side, and that there is *no* separate client-side Purchase
  tag also configured in GTM that would double-count against it (claim 6).
- **Shopify's Customer Privacy / consent banner configuration** — the theme code correctly reads
  `Shopify.customerPrivacy.currentVisitorConsent()` and listens for `visitorConsentCollected`,
  but whether the actual consent banner is enabled, and how its four categories map to the
  code's `marketing`/`analytics` booleans, is admin-side config outside the repo.
- **Whether a Shopify Web Pixels app extension exists** — the repo itself contains no
  `extensions/` directory or app-extension config for Web Pixels, so if one exists it lives
  purely in Shopify admin, unreachable from here.
- **Whether Odoo actually receives and stores `journey_id`, `gclid`/`fbclid`, or a detailed lead
  source today** on the leads that go via the `ZV_LEAD_ENDPOINT` webhook path (Vista, callback,
  Onderweg) — this audit can only confirm what the theme *sends*, not what Odoo does with it.

---
*Audit performed 2026-09-11 against `feature/camera-hardware-add-products` (current branch) and
cross-checked against `main`, `feature/contact-form-odoo`, `veronica-origin/main`, and all other
local/remote branches for anything not yet merged. No code was changed.*
