# Videodeurbel + Afstandsbediening Uitbreidingen checkboxes (2026-09-26)

## What shipped

Two real Shopify products get a live-priced checkbox in the "Uitbreidingen" accordion on
every Langer Thuis/Mijn Thuis package card except Vista (Inzicht, Zeker, Beschermd, Alert,
Protect):

- **Videodeurbel** — handle `koop-video-deurbel-750`, SKU ADC-750.
- **Afstandsbediening** — handle `huur-afstandsbediening`, SKU H0010.

Both resolved live from `all_products[handle]` in `sections/oplossingen.liquid` (never a
hardcoded price, variant id or purchase type) via the existing `ltc_addons` mechanism that
was already built for exactly this (see the comment above `ltc_addons` in that file). Beschermd
and Protect (Climax) keep their existing "Uitbreiding hardware →" link and get a new **minimal**
Uitbreidingen accordion holding only these two checkboxes — never Woning or Ontzorgpakket,
which still don't apply to Climax pricing (Thijs, 2026-09-25 decision, unchanged). Vista is
skipped entirely: it has no real add-to-cart (lead-capture only), so a priced checkbox there
would have nothing to attach to.

A new **"Extra uitbreidingen →"** link (reusing the existing `.ltc__hwlink` markup/style) sits
under the accordion on all 5 cards, linking to
`/pages/camera-hardware?pakket={inzicht|zeker|beschermd|alert|protect}#grotere-woning`.

Checking a box keeps ONE shared priced cart line for that product in the cart, at quantity
`zv_promo_package_qty` (3) — the same qty-3/"Eerste 3 maanden" discount mechanic the Woning
line (N0008) already uses, generalized in `sections/oplossingen.liquid`'s
`syncAddonLines()`/`ADDON_VARIANT_IDS`/`addonsWanted()` (JS), modeled directly on
`syncWoningLine()`/`woningLinePlan()`. Unlike Woning, an add-on is either wanted (recorded in
some package line's `Uitbreidingen` property) or not — never a per-floor multiple — and it gets
its own removable row on `/cart`/Overzicht (not a Woning-style ghost line), since it's a
standalone product a customer might simply not want, not a per-package attribute. The
cart-drawer version stays a Woning-style non-row: the package line's own cloned addons
checkbox is already the way to toggle it there, so a second remove button on its own row would
just bounce back on the next sync.

Clean display names ("Videodeurbel"/"Afstandsbediening", never the raw Shopify admin title —
one product's title still carries a `***` placeholder) come from a new **name-only**
`addonNames` array in `pricing/pricing.config.json`, merged into the existing
`install_names`/`zv_install_names_by_handle`/`zv-item-names` plumbing by
`scripts/build_pricing.py`. This is deliberately a different mechanism from the pre-existing
`addons[]` array in that same config file (`vista-home-camera`, `ontzorgpakket`, etc.): that
array's schema hardcodes a `price.amountCents`/`display` literal, which is exactly what these
two must never do (Videodeurbel is currently a one-time purchase; Alex is converting it to a
rental shortly, and its price is Alex's to change without a theme redeploy). `addonNames` has
no price field at all — only `productHandle`/`sku`/`name`.

## Known blocker: both products are "sold out" on the storefront today

Confirmed live 2026-09-26 against a disposable `zz-validate-uitbreidingen-20260926` theme:
`all_products[handle]` **does** resolve both products and their live price (Videodeurbel
€299,00, Afstandsbediening €0,80 at the time of testing) even though the Admin API's
`onlineStoreUrl` read back `null` for both a few hours earlier — so the checkbox UI, its live
price and the `Uitbreidingen` property all work correctly today.

But `POST /cart/add.js` for either variant fails with **HTTP 422**:

```
{"status":422,"message":"The product '(Koop) Video Deurbel 750  ***' is already sold out."}
{"status":422,"message":"The product '(Huur) Afstandsbediening' is already sold out."}
```

This is the same failure shape already documented in CLAUDE.md for N0001-N0003 on
2026-09-25: inventory tracked on, policy DENY, stock <= 0. `syncAddonLines()` catches this
failure silently (same convention as `syncWoningLine()`) — the package itself still adds to
the cart correctly, and the checkbox's `Uitbreidingen` property still records the customer's
choice for Odoo, but **no priced line is added for the add-on until this is fixed in Shopify
Admin** (turn off inventory tracking, or set available stock, or change the policy to allow
overselling — a product change, out of scope for this repo per the 2026-09-23 hard rule).
Check both products' inventory settings before expecting the add-on line to actually appear
in a cart.

## Scope boundaries (deliberate)

- No change to `snippets/zv-cart-guard.liquid` or the checkout gates in
  `sections/zv-checkout-overview.liquid` (`cart_needs_fix`/`cart_pkg_undiscounted`/
  `cart_woning_bad`) — those two add-ons are optional standalone products, not part of the
  package×3+install invariant those gates protect, and the guard already ignores any line it
  doesn't recognize, so nothing there needed to change.
- No selling-plan-based "monthly vs one-time" label: neither product has any selling plan
  attached (confirmed via Admin API 2026-09-26) — this store's whole "rental" model is the
  qty-3/automatic-discount trick, not Shopify subscriptions, so there's no live signal to
  hardcode a "/mnd" suffix from. The checkbox just shows the live price with no suffix.
