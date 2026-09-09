# Zo Veilig — Shopify theme

## Checkout flow

Winkelwagen → Overzicht → Shopify checkout.

- `/cart` — `templates/cart.json` → `sections/zv-cart.liquid`. The primary CTA links to
  `/cart?view=overzicht` (Shopify alternate cart template) instead of submitting to checkout.
- `/cart?view=overzicht` — `templates/cart.overzicht.json` → `sections/zv-checkout-overview.liquid`.
  Read-only final review of the live `{{ cart }}` (package, pricing breakdown, AV consent).
  Empty cart redirects (client-side) back to `/cart`.
- On "Verder naar veilig afrekenen", the page POSTs to `/cart/update.js` with two cart
  `attributes` (so they land on the order), then navigates to `/checkout`:
  - `av_akkoord` — `"ja"` once the Algemene Voorwaarden checkbox is ticked.
  - `av_akkoord_tijdstip` — ISO 8601 timestamp of that click.

Pricing on the Overzicht page never hardcodes an amount or duration (enforced by
`scripts/check_pricing.py` check #9). It reads live cart totals (`item.final_line_price`)
for what Shopify actually charges, and the confirmed per-package commercial terms
(activation, intro-promo discount, contract duration, indicative contract value) via
`{%- include 'zv-pricing' -%}`, matched to the cart's subscription line item (see **Product
data** below for how a subscription is identified) through its `custom.finder_key` product
metafield. See the comment at the top of `sections/zv-checkout-overview.liquid` for the
finder_key → package id mapping.
**If the cart holds more than one distinct recognized package** (e.g. Langer Thuis Inzicht +
Mijn Thuis Alert together), the commercial-terms rows are hidden entirely rather than
picking one package's numbers — a 36-month Inzicht contract and a 12-month Alert contract
can't both be represented by a single set of rows, and showing either alone would be wrong,
not just incomplete.

**Every checkout entry point must land on `/cart?view=overzicht` first, never straight on
Shopify's own `/checkout`** — Overzicht is where `av_akkoord` consent is captured, so
skipping it is a compliance gap, not a UX inconsistency. This bit a real bug once (confirmed
2026-09-09): the Oplossingen page's post-add-to-cart drawer ("Naar afrekenen") and its detail
modal's "Direct afrekenen" button both linked straight to `/checkout`. Both now resolve a
`data-cart-url` (from `routes.cart_url`) into `overzichtUrl` and use that instead — see
`sections/oplossingen.liquid`'s `addToCart()`. If you add a new checkout entry point anywhere
in the theme, it must go through Overzicht the same way; grep for a literal `/checkout` string
outside `sections/zv-checkout-overview.liquid` itself as a quick regression check.

**A subscription package must never sit in cart without the activation fee** (see **Pricing
pipeline** below for what that is). Enforced twice, since nothing stops the fee being removed
after the fact or a package reaching cart through an entry point that doesn't add it (e.g. the
standalone Shopify product page): client-side, `snippets/zv-cart-guard.liquid` (rendered on
`/cart` and `/cart?view=overzicht`) checks the live cart on load and auto-adds the fee, then
reloads, if a subscription line exists without it; server-side, `zv-checkout-overview.liquid`
computes `cart_needs_activation` and disables the checkout button outright as a fail-safe if
the client-side fix hasn't run yet or fails. The standalone product page's own Dynamic
Checkout buttons (Shop Pay etc., `show_dynamic_checkout` in `templates/product.json`) skip
straight to Shopify checkout with no chance for either guard to run, so they're switched off
entirely (2026-09-09) rather than patched — there's no client-side hook into that flow.

## Product data (confirmed from the real store, 2026-09-09)

Pulled live via `shopify theme dev`'s local proxy (`/products.json`) and `shopify theme
console` against `zoveiligdev.myshopify.com` — not guessed. Re-pull if this ever looks stale;
don't re-guess it.

**Subscription detection: use `product.type`, not a tag.** Every live package product across
all three lines shares `product.type == "Beveiligingsabonnement"`. Tags differ per line and
none of them carry `abonnement`:

| Product (title) | handle | type | tags | `custom.finder_key` | SKU |
|---|---|---|---|---|---|
| Langer Thuis Inzicht | `langer-thuis-inzicht` | Beveiligingsabonnement | keuzehulp, Langer Thuis | `aware` | LT-INZ |
| Langer Thuis Zeker | `langer-thuis-zeker` | Beveiligingsabonnement | keuzehulp, Langer Thuis | `aware_plus` | LT-ZEK |
| Langer Thuis Beschermd | `langer-thuis-beschermd` | Beveiligingsabonnement | keuzehulp, Langer Thuis | `care` | LT-BES |
| Mijn Thuis Alert | `mijn-thuis-alert` | Beveiligingsabonnement | keuzehulp, Mijn Thuis | `secure` | MT-ALE |
| Mijn Thuis Protect | `mijn-thuis-protect` | Beveiligingsabonnement | keuzehulp, Mijn Thuis | `guard` | MT-PRO |
| Mijn Thuis Vista | `mijn-thuis-vista` | Beveiligingsabonnement | keuzehulp, Mijn Thuis | `secure_plus` | MT-VIS |
| Veilig Onderweg Paniek Meldkamer | `veilig-onderweg-paniek-meldkamer` | Beveiligingsabonnement | keuzehulp, prijs-volgt, Veilig Onderweg | `liogo_solo` | — |
| Veilig Onderweg Zorgmeldkamer | `veilig-onderweg-zorgmeldkamer` | Beveiligingsabonnement | keuzehulp, prijs-volgt, Veilig Onderweg | `liogo_guard` | — |

`sections/zv-cart.liquid` and `sections/zv-checkout-overview.liquid` both classify a line item
as a subscription via `item.product.type == sub_type or item.product.tags contains sub_tag`
(`sub_type` setting, default `Beveiligingsabonnement`, is the real signal; `sub_tag`, default
`abonnement`, is kept only as a fallback OR — no live product currently uses it, tags aren't
reliable across lines the way `type` is).

**The pakket-matcher's `custom.finder_key` mapping (`aware`→inzicht, `aware_plus`→zeker,
`care`→beschermd) was already correct** — confirmed against the table above, not changed.
"Langer Thuis Inzicht/Zeker/Beschermd" sharing their names with the Oplossingen package names
is not a separate, undiscovered mapping to switch to; it's the same finder_key scheme already
pointing at exactly those products under the hood. Not purchasable/unpriced: CR123 (0 stock,
an accessory SKU, not a package) and a Draft "TEST – Odoo Sync" product (ignore, test data).

## Pakket-matcher (Vergelijk pakketten page)

`/pages/vergelijk-pakketten` (`templates/page.vergelijk-pakketten.json` → `sections/vergelijk-pakketten.liquid`)
carries the "Welk pakket past bij uw situatie?" scenario cards above the Inzicht/Zeker/Beschermd table.
Note: this lives on the *Vergelijk pakketten* page, not `/pages/oplossingen` — the Oplossingen page has
its own package cards and links here via `zv-route` key `vergelijk-pakketten`.

- Each card is a `scenario` block; its `package` setting (inzicht/zeker/beschermd) is the scoring
  mapping and is editable in the theme editor. **The shipped mapping is a placeholder and still
  needs product sign-off (Robi/Robert)** — it was guessed from the card wording, not confirmed.
- Scoring is pure client-side (`{% javascript %}` in the section): most selected cards per package
  wins; ties go to the higher tier (beschermd > zeker > inzicht); zero selected → nothing highlighted.
- The advice bar's add-to-cart resolves package → real product through the same
  `custom.finder_key` metafield mapping the Overzicht page uses (`aware`→inzicht, `aware_plus`→zeker,
  `care`→beschermd) on the section's `collection` setting (default `langer-thuis`). No variant ids in
  code. If the same variant is already in the cart it bumps that line via `/cart/change.js` instead
  of adding a second line (Shopify only merges lines whose properties match exactly, and the
  Oplossingen card-add attaches `Bron: Oplossingen` while this one attaches `Bron: Vergelijk pakketten`).
- The "Meest geschikt voor" table row and the advice bar share the three tagline settings
  (`tagline_inzicht/zeker/beschermd`); JS reads the bar's text from the table cell so they can't drift.
- See **Product data** below for the confirmed `finder_key` → product mapping this uses and for
  how the cart/Overzicht page now correctly recognizes these packages as subscriptions.

## Pricing pipeline

`pricing/pricing.config.json` is the single source of truth for activation fee, intro promo,
contract terms and indicative contract value. `python3 scripts/build_pricing.py` regenerates
`pricing/pricing.generated.json` and `snippets/zv-pricing.liquid` (committed, generated —
don't hand-edit). `python3 scripts/check_pricing.py` verifies the maths and that no theme
file carries an independent literal price or duration; CI runs both on every push/PR.

**Activation fee**: `activation.productHandle`/`sku` in the config identify the real Shopify
product ("Activatie en installatie", confirmed live 2026-09-09) — add-to-cart flows resolve it
by handle (`all_products[zv_activation_handle]`), never a hardcoded variant id, same pattern as
package lookup via `finder_key`. See **Checkout flow** above for how its presence in cart is
enforced.

**Intro promo, live on/off switch**: `promo.enabled` in the config means "this promo mechanism
is a confirmed, computed part of the pricing model" (build_pricing.py won't compute
`promoMonthly`/`promoDiscountTotal` at all if it's `false`) — it is **not** the day-to-day
toggle and should almost never change. Whether the discount is actually showing on the
storefront right now is controlled entirely by the Shopify **theme setting** `zv_promo_live`
("Zo Veilig · Introductiekorting" in the theme editor, schema in
`config/settings_schema.json`), a checkbox Thijs can flip himself with **no code change or
redeploy** — every promo-specific render (`zv_promo_active` in `zv-checkout-overview.liquid`
and `actie-korting.liquid`) is gated on `promo.enabled`/`ratePercent` from config AND this live
setting both being true. Default is off (2026-09-09: the promo product doesn't exist in
Shopify yet), with the real 50%/3-months figures already computed and waiting in
`zv-pricing.liquid` — turning the setting on shows them immediately, nothing else to do.

## Shopify store

The test store is **`zoveiligdev.myshopify.com`** (admin: `admin.shopify.com/store/zoveiligdev`).
The live/synced theme on it is named "Zoveilig-Test-shopify/main" (a theme *name*, matching the
GitHub repo name — **not** the store's domain; `zoveilig-test-shopify.myshopify.com` does not
exist and returns a 404). Always pass `--store zoveiligdev.myshopify.com` on every `shopify
theme` CLI command, or `--environment zoveiligdev` to read it from `shopify.theme.toml` at the
repo root. Never guess the store handle from the repo or theme name again — a wrong guess gets
silently cached as this project's default store in `~/Library/Preferences/shopify-cli-theme-conf-
nodejs/config.json` and causes every subsequent command to fail against the wrong store, even
with a valid login (that's exactly what happened once already).

## Working rules for Claude Code on this repo

- **`shopify theme check` does not catch every deploy-breaking error.** Shopify's GitHub
  sync runs its own, stricter server-side Liquid validator. It has at least one known gap
  `theme check` misses entirely: a literal `{` or `}` character inside a quoted string
  *inside* a `{{ }}` output tag (e.g. `{{ x | replace: '{token}', y }}`) breaks its
  `}}`-closing scan and gets the whole file — and anything referencing it, like a JSON
  template's `"type"` — rejected. Never put `{`/`}` inside a string literal within `{{ }}`;
  if you need a placeholder token, use something like `[token]`, or better, avoid
  string-replace templating and compose the output from multiple schema settings + plain
  `{{ }}` output instead.
- **Before pushing anything Liquid to `origin main`, validate against Shopify's real
  validator, not just `shopify theme check`** — e.g. `shopify theme push --unpublished
  --theme "<throwaway-name>" --only <changed files>` against a disposable unpublished
  theme, then delete it. `origin main` is connected to Shopify's GitHub sync for the live
  test theme, so a rejected file there is a live regression, not just a failed CI check.
- **If the Shopify CLI prompts for an interactive login (a `User verification code` /
  `activate-with-code` device-code flow), stop and wait.** Print the link and the code,
  tell the user you're waiting, and do not kill the process, work around it, or push
  without having validated. The user completes the login in their own browser; once done
  once, the CLI stays authenticated on their machine.
- **Investigation findings meant to inform future work must be written into `docs/` or
  `CLAUDE.md`, not just reported back in a chat session** — Claude Code sessions do not
  share context with each other or with the web chat. A finding that only exists in a past
  conversation is invisible to the next session and will get silently re-investigated or,
  worse, assumed not to exist. If it matters later, it needs a file in this repo.
