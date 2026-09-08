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

## Pricing pipeline

`pricing/pricing.config.json` is the single source of truth for activation fee, intro promo,
contract terms and indicative contract value. `python3 scripts/build_pricing.py` regenerates
`pricing/pricing.generated.json` and `snippets/zv-pricing.liquid` (committed, generated —
don't hand-edit). `python3 scripts/check_pricing.py` verifies the maths and that no theme
file carries an independent literal price or duration; CI runs both on every push/PR.
