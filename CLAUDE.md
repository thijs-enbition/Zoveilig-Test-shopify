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
`{%- include 'zv-pricing' -%}`, matched to the cart's subscription-tagged line item through
its `custom.finder_key` product metafield. See the comment at the top of
`sections/zv-checkout-overview.liquid` for the finder_key → package id mapping.
**If the cart holds more than one distinct recognized package** (e.g. Langer Thuis Inzicht +
Mijn Thuis Alert together), the commercial-terms rows are hidden entirely rather than
picking one package's numbers — a 36-month Inzicht contract and a 12-month Alert contract
can't both be represented by a single set of rows, and showing either alone would be wrong,
not just incomplete.

## Pricing pipeline

`pricing/pricing.config.json` is the single source of truth for activation fee, intro promo,
contract terms and indicative contract value. `python3 scripts/build_pricing.py` regenerates
`pricing/pricing.generated.json` and `snippets/zv-pricing.liquid` (committed, generated —
don't hand-edit). `python3 scripts/check_pricing.py` verifies the maths and that no theme
file carries an independent literal price or duration; CI runs both on every push/PR.

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
