# Pricing / add-to-cart audit — file by file

Legend: 🟢 Live (Shopify product/variant) · 🟡 Config (pricing.config.json via zv-pricing include — manual sync risk) · 🔴 Hardcoded (literal number, disconnected from both)

| File | What it shows | Category |
|---|---|---|
| sections/vergelijk-pakketten.liquid | Comparison table header prices (€19,95 / €24,95 / €39,95 p/m) | 🟡 Config — zv_inzicht_monthly etc. from the zv-pricing include |
| sections/vergelijk-pakketten.liquid | Pakket-matcher advice bar add-to-cart | 🟢 Live — resolves package→product via custom.finder_key, posts /cart/add.js with the real variantId/sku read at render time. No price shown in the advice bar itself. |
| templates/product.json | Product page price (main-product section) | 🟢 Live — stock Dawn price block, no override |
| sections/oplossingen.liquid | Package price tiles (Inzicht/Zeker/Beschermd/Alert/Protect/Vista) | 🟢 Live — explicit comment confirms price is read live from the Shopify variant |
| sections/oplossingen.liquid | "Woning groter dan 100 m²" surcharge (+€4/mnd, lines 156, 352–357, 931, 1046) | 🔴 Hardcoded — see call-out 1 |
| sections/oplossingen.liquid | Add-on rows: Domotica {{ 400 \| money }}/mnd, Huisdier-upgrade/Extra sensoren/Extra toegangspunten {{ 0 \| money }} | 🔴 Hardcoded — see call-out 1 |
| sections/zv-checkout-overview.liquid (Overzicht) | Line prices, "Maandbedrag", "Vandaag te betalen" | 🟢 Live — cart.items / item.final_line_price |
| sections/zv-checkout-overview.liquid (Overzicht) | Promo discount, activation fee, contract duration, indicative contract value | 🟡 Config — via zv-pricing |
| sections/zv-cart.liquid | All line prices, "Vandaag te betalen", monthly total | 🟢 Live — item.final_line_price |
| sections/actie-korting.liquid | Monthly/promo prices | 🟡 Config — via zv-pricing |
| sections/finder-preview.liquid (Keuzehulp result cards) | priceCents | 🟢 Live — p.price |
| sections/camera-hardware.liquid | Buy/rent prices for 10 camera SKUs (€175,00 / €15,31 huur, etc.) | 🔴 Hardcoded — see call-out 2 |

**Call-out 1 — oplossingen.liquid surcharge/add-on prices, correct today, silently wrong later:** This file never includes zv-pricing. The +€4/mnd extra-etage text, the same value baked into every package's `plus.price` JSON field, and the `{{ 400 | money }}` / `{{ 0 | money }}` add-on rows are literal values that currently happen to match `pricing.config.json`'s `surcharges.extra-etage` and `addons.alarmcom-domotica` — but nothing wires them together. The file's own comment claims "no literal amount lives in this source" — true for `check_pricing.py`'s scanner (it only flags `€\d+,\d{2}` in raw source text, and these values only become euros after Liquid renders them), but not true in the sense that matters: they're still disconnected numbers that can silently drift from the real config.

**Call-out 2 — camera-hardware.liquid, fully disconnected pricing:** A plain JS array (`koop:175.00, huur:15.31, sku:'CAM-BINNEN'`, ×10 SKUs) drives the whole configurator. Not read from Shopify, not read from pricing.config.json, not caught by check_pricing.py (same blind spot). Phone/callback-only page, so no checkout-mismatch risk, but the displayed price is 100% manual.

**Most important finding, triggered directly by the subscription-detection work:** `zv-cart.liquid`'s own header comment states the "Vandaag te betalen"/"Maandbedrag" split only produces the correct Shopify checkout total if the subscription product is priced at €0 in Shopify or carries a selling plan — because Shopify's actual checkout always charges the full cart total regardless of how the theme visually buckets it. Langer Thuis Inzicht (LT-INZ) is priced at its full monthly rate in Shopify admin, not €0, with no selling plan anywhere in the repo. Confirmed directly via a real cart (`/cart.js`, no discount applied): the actual Shopify checkout total for one Langer Thuis Inzicht is the raw monthly price — no activation fee, no prepay adjustment, nothing added. The Overzicht/cart pages' own "Vandaag te betalen: €0,00" display was, separately, also wrong (it undercounts even that raw charge).

**The confirmed model — two separate flows:**
1. **The purchase**, in Shopify, today: a universal one-time "Activatie en installatie" product (€49,00) plus a per-package "eerste 3 maanden" product priced at monthly × 3 × 0.5 (the same figures already computed in `pricing.config.json`'s `promoDiscountTotalCents`). Two separate cart lines, charged once, no selling plan, nothing recurring inside Shopify. The subscription product's own catalog price is not what gets charged at checkout.
2. **The contract**, from month 4 onward: SEPA, run entirely through the existing Shopify → Odoo connector once the order exists with clear product/line data. Not modeled or validated in the theme — out of scope for theme work entirely.

Implementation of the purchase-side fix is the current task (see the relevant task history for the product list and exact mechanism).

## Update 2026-09-09 (later same day) — activation fee wired in, promo deferred

The "Activatie en installatie" product now exists in Shopify (published to Online Store,
handle `activatie-en-installatie`, SKU `ACT-INSTALL`, €49,00, `product_type: service`, no
tracked inventory) and is confirmed by direct query against `zoveiligdev.myshopify.com` via
`shopify theme dev`'s local proxy and `shopify theme console` — not by product.json handle
guessing. It's now wired into every package add-to-cart flow (Oplossingen page, Vergelijk
pakketten advice bar) as a second cart line, resolved by handle via
`pricing.config.json` → `activation.productHandle`/`sku` (no hardcoded variant id), deduped
against the live cart in JS so it's only ever charged once per cart regardless of how many
packages/add-ons are added afterwards.

The promo product ("eerste 3 maanden" 50%-off line item) does **not** exist yet.
`pricing.config.json` `promo.enabled` is set to `false` for now (the agreed 50%/3-months
figures are left in place, untouched, so re-enabling is a one-line flip back to `true` plus
`python3 scripts/build_pricing.py` once the promo product lands). `build_pricing.py` computes
a `promo.active` flag (`enabled AND ratePercent > 0`); every promo-specific display (the
Overzicht "Eerste 3 maanden (X% korting)" row, the cost-card's discounted-then-full-price
copy, the `/pages/actie-korting` promo landing page's badge/struck-through pricing/disclosure)
renders conditionally on `zv_promo_active` and is currently hidden. `actie-korting.liquid`
degrades to a plain package-price page rather than being unpublished, so the URL keeps
working; nothing there currently claims a discount that isn't real.

**The "Vandaag te betalen" bug this whole audit was chasing is now fixed, not just
documented.** `zv-cart.liquid` and `zv-checkout-overview.liquid` previously excluded
subscription line items from "Vandaag te betalen" on the theory they'd be priced at €0 or
carry a selling plan in Shopify — neither was ever true. Verified directly against a real
cart: adding one Langer Thuis Zeker (€24,95) + the activation fee (€49,00) makes Shopify's
own `cart.total_price` **€73,95**, while the theme was displaying "Vandaag te betalen:
€49,00" (or €0,00 before the activation fee existed) — a real, verified undercount of what
the customer is actually charged. Both files now sum every cart line into "Vandaag te
betalen" unconditionally (no is-subscription exclusion), so it always equals
`cart.total_price` by construction and can't drift from what Shopify actually charges again.
Subscription-item classification is now purely informational (the "p/m" badge, the
"Maandbedrag" figure representing the amount that continues via SEPA-incasso each month
after today) — verified against three hand-computed scenarios (package only: €19,95 = cart
total exactly; package + activation: €68,95/€73,95 depending on package, matching
`cart.total_price` exactly in both cases; indicative contract value cross-checked against
`pricing.generated.json`'s own formula).

**New findings from this pass, not yet actioned:**
- **Langer Thuis Inzicht (LT-INZ) is live-priced at €0,50 in Shopify admin**, not the €19,95
  in `pricing.config.json` — confirmed 2026-09-09 via the same live product query. Every
  other package's live price matches its config value exactly; only this one drifted. Not
  changed by this pass (a Shopify admin product-price edit is a business action, not a theme
  fix, and this may be a live test Thijs is running) — flagging so it isn't mistaken for a
  theme bug if a Langer Thuis Inzicht checkout total ever looks unexpectedly low.
- **The standalone Shopify product page (`/products/<package-handle>`, `templates/product.json`,
  Dawn's stock `buy_buttons` block) is live and reachable, and lets a customer add a package
  to cart with no activation-fee line and no cart-total fix applied** — it's the generic Dawn
  buy-button shared by every product in the store, not something this pass touched. If that
  page is a real customer entry point (not just an internal/preview URL), it needs the same
  activation-fee wiring the Oplossingen and Vergelijk pakketten pages now have, or should be
  kept out of the customer journey (e.g. via the theme editor / navigation) until it does.
- The promo product's absence is why `discountPercent` isn't a new schema field: this pass
  reused the existing `promo.enabled` flag rather than adding one, since it already implements
  exactly "0 discount, full price charged, one-line revert" — see `pricing.config.json`
  `promo.enabledNote` for the reasoning.
