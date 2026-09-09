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
