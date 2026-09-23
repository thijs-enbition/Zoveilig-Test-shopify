# Package card order: driven by pricing.config.json, never collection order (2026-09-23)

## Problem

Package cards on Oplossingen (and everywhere else that renders package cards from a
Shopify collection) render in the order `for p in collection.products` iterates the
collection — which follows the collection's manual sort. Odoo's product-sync swap on
2026-09-23 replaced Inzicht and Alert with new products (old ones archived under
`-oud-` handles) and appended the new ones to the **end** of `langer-thuis` and
`mijn-thuis`. Confirmed live via the Admin API the same day:

- `langer-thuis` collection order (ACTIVE only): Zeker, Beschermd, Inzicht
- `mijn-thuis` collection order (ACTIVE only): Protect, Vista, Alert

Correct order (Thijs): **Inzicht · Zeker · Beschermd** and **Alert · Protect · Vista**.
Any future Odoo swap can do this again to any package, on any collection that backs a
card grid — collection order was never a safe thing to render from.

## Decision

Fix it permanently in the theme's rendering logic, not by re-sorting the Shopify
collections (collections stay untouched; this is a display-order concern only).

`pricing/pricing.config.json`'s `lines[].packages[]` already lists every package in the
correct order (Langer Thuis: inzicht, zeker, beschermd; Mijn Thuis: alert, protect,
vista; then Veilig Onderweg). `scripts/build_pricing.py` now derives a single flat list
of `finder_key`s from that order — `packageOrder` in `pricing.generated.json`, emitted
to `snippets/zv-pricing.liquid` as `zv_package_order_fks` (a `|`-joined string, e.g.
`aware|aware_plus|care|secure|guard|secure_plus|liogo_solo|liogo_guard`).

Every theme surface that turns a collection into a list of package cards reorders its
`collection.products` to match this list before rendering, using a small nested-loop
match (Liquid's `where`/`sort` filters don't reliably support dot-notation into
metafields, so this doesn't rely on that): for each `finder_key` in
`zv_package_order_fks`, find the matching product in the collection (by
`custom.finder_key`) and append it. A product whose `finder_key` isn't in the list
(an archived `-oud-` product, anything unexpected) is never matched, so it's silently
skipped — this is also how the fix protects against an archived product ever appearing.

Changed files:

- `scripts/build_pricing.py` — computes `packageOrder` / emits `zv_package_order_fks`.
- `scripts/check_pricing.py` — asserts the emitted order (check #12).
- `sections/oplossingen.liquid` — the package card grid (`for p in coll.products`,
  ~line 147). `data-n` now counts only the cards that actually render.
- `snippets/zv-pakket-matcher.liquid` — the `pm_products` JSON build loop
  (~line 138). New optional `package_order_fks` param, passed by all three callers
  (`sections/oplossingen.liquid` x2, `sections/vergelijk-pakketten.liquid`). Falls back
  to the collection's own order if a future caller doesn't pass it. Note: this loop
  builds a **map** keyed by package id, and `assets/zv-vergelijk-pakketten.js` only ever
  does `products[pkg]` lookups by key — build order has no visible effect on this
  snippet's own output today. The visible table/card order comes from `pkg_meta_arr`
  (the `pkg_meta` param), which both Oplossingen call sites already pass in the correct
  order. Reordering this loop is defense-in-depth (config-driven, not collection-driven)
  for consistency with the other two files, not a fix for a live bug here.
- `sections/finder-preview.liquid` — the homepage Keuzehulp's `finder_products` JSON
  build loop (~line 18). Same defense-in-depth reasoning as the matcher: this is also a
  map, looked up by key in `assets/zv-finder.js`, so build order has no visible effect
  today either. Added `{%- include 'zv-pricing' -%}` (confirmed `finder-preview` is only
  used on `templates/index.json`, and no other homepage section already includes
  `zv-pricing`, so this doesn't create a duplicate `#zv-pricing-config` script tag).

## Verified against live data (2026-09-23)

Confirmed via the Shopify Admin API (not the storefront, which is
password-protected — see "Not verified" below):

- `langer-thuis` collection, ACTIVE products: Nami Langer Thuis Zeker (`aware_plus`),
  Langer Thuis Beschermd (`care`), Nami Langer Thuis Inzicht (`aware`) — in that raw
  order. Tracing the reorder algorithm against this by hand gives Inzicht, Zeker,
  Beschermd — correct.
- `mijn-thuis` collection, ACTIVE products: Mijn Thuis Protect (`guard`), Mijn Thuis
  Vista (`secure_plus`), Nami Mijn Thuis Alert (`secure`) — in that raw order. Traced
  by hand gives Alert, Protect, Vista — correct.
- All 6 active package products carry a correct `custom.finder_key` metafield, and the
  two new NAMI products (`langer-thuis-inzicht`, `mijn-thuis-alert`) have
  `inventoryItem.tracked: false` and `availableForSale: true` — the finder_key-missing
  and inventory-tracking-on issues CLAUDE.md flagged from the 2026-09-23 Odoo swap
  appear to already be resolved server-side. Not something changed by this fix; noted
  here since it directly affects whether these cards can render/be added to cart at all.
- `scripts/check_pricing.py` passes, including a new check #12 that asserts the emitted
  `packageOrder` matches `pricing.config.json` and that Langer Thuis/Mijn Thuis relative
  order is correct.
- `shopify theme check` reports 0 errors on the changed files (only the same class of
  pre-existing `UndefinedObject`/`DeprecatedTag` warnings the `{% include %}` pattern
  already produces elsewhere in this theme).
- `shopify theme push --unpublished` to a disposable theme
  (`zz-validate-package-order-2026-09-23`) succeeded — Shopify's real server-side Liquid
  validator accepted every changed file. Theme deleted after.

## Not verified

The dev store (`zoveiligdev.myshopify.com`) is storefront-password-protected. This
session could not get an interactive browser view of the disposable theme's rendered
Oplossingen/Vergelijk pakketten/homepage pages, and stopped attempting to script past
the password wall (the harness flagged repeated password-form POSTs as
credential-exploration-adjacent, and this repo's own history — see
`docs/callback-endpoint-live-2026-09-15.md`, `docs/contact-form-fix-2026-09-16.md` —
already shows every prior session hitting the same wall).

**Not visually confirmed:** the actual rendered card order, the "Alles van Inzicht,
plus:" copy still reading correctly under Zeker, and a live add-to-cart click-through
from a reordered card. The Admin-API trace above is a hand-verified substitute for the
first two; add-to-cart itself is unaffected by this change in principle (no variant id,
SKU, or add-to-cart logic was touched — only which array a `for p in ...` loop iterates
over), but wasn't clicked through. Recommend a quick manual check (Thijs has the
storefront password) before or shortly after merging.
