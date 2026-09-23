# Prepaid "Eerste 3 maanden" line item — 2026-09-22

Branch `fix/prepay-promo-lineitems-2026-09-22`. Two-session note: the session that wrote this
task's brief has no memory of anything below unless it's in this file or the diff.

## What changed, and why

The live "Eerste 3 maanden" automatic Shopify discount (50%, amount-off-products, active since
2026-09-16) applied a flat 50% to whatever package line was in cart at checkout — verified
against real orders (#1014 pre-discount vs #1019 post-discount: 50% off one month of Zeker,
once, at checkout). That's wrong in two ways: it can reach the installation fee, and it
discounts the package's own monthly price.

Confirmed correct model (kosten.xlsx + Thijs, 2026-09-22): **the installation fee is never
discounted, at any tier**, and the 50%-off-3-months value is a **separate, positive,
always-independent one-time charge** collected today alongside it:

```
vandaag = installatie_kosten (€0 / €35 / €99, unchanged) + promoDiscountTotalCents
```

Because it's a flat add-on rather than a discount on installation, there is no negative-value
case — no capping logic for "Geen installatie" or "Telefonische ondersteuning", and none was
added. The **monthly recurring price is never modified anywhere in this flow.** SEPA billing
(start date, mandate, recurring collection) is handled entirely in Odoo and is out of scope of
this repo; this build only changes what Shopify collects at checkout today.

## The architectural consequence: the package product leaves the cart

The plain package product is **no longer added to the cart at all**. A package purchase is now
exactly two lines: the chosen installation option at full price, plus that package's own
prepaid promo product. Shopify never sees the monthly rate.

That removed the thing every cart/checkout surface used to identify "which package is this" —
`product.type == "Beveiligingsabonnement"` plus `custom.finder_key`. **The 5 new promo products
carry the same `custom.finder_key` values instead, and are now the cart-side package identity
anchor** (Thijs picked this over keeping a €0 package line, 2026-09-22). Everything that used
to key off a subscription line now keys off the promo line:

| Surface | Before | Now |
|---|---|---|
| `zv-checkout-overview.liquid` | `is_sub` line → finder_key → terms/ICV/consent | promo line → finder_key → same |
| `zv-cart.liquid` | `is_sub` line → monthly rate | promo line → monthly rate |
| `zv-cart-guard.liquid` | `product_type === SUB_TYPE` | promo variant ids, split nami/climax |
| `oplossingen.liquid`, `zv-vergelijk-pakketten.js` | add package variant | add promo variant |

**Visible consequence, accepted deliberately:** the customer's cart no longer shows a line named
after the subscription package. It shows e.g. "Installatie aan huis" + "Eerste 3 maanden korting
— Zeker". The promo product's own per-package name is what identifies the purchase, in the cart
and on the Shopify order.

**Side effect worth knowing for anything downstream of Shopify orders:** an order's line items
are now the install product + the promo product. The package SKU (LT-ZEK etc.) no longer appears
as a line item; it survives only as the `SKU` line-item property the add-to-cart flows attach,
and GA4 `add_to_cart` still reports the package SKU (not the promo SKU) as `item_id`. Anything
that reads Shopify order lines to work out which package was sold needs to read the promo
product instead. Not investigated further here — the brief explicitly scoped Odoo out.

## The 5 new Shopify products

Created 2026-09-22 on `zoveiligdev.myshopify.com`, all ACTIVE, published to Online Store
(verified via `publishedOnPublication`, **not** `onlineStoreUrl` — that field is a known false
negative on this store, see `docs/nami-install-choice-2026-09-21.md`).

| Package | Title | handle | SKU | price | `custom.finder_key` | Product id |
|---|---|---|---|---|---|---|
| inzicht | Eerste 3 maanden korting — Inzicht | `eerste-3-maanden-inzicht` | PROMO-INZ | €29,93 | `aware` | 16033642152317 |
| zeker | Eerste 3 maanden korting — Zeker | `eerste-3-maanden-zeker` | PROMO-ZEK | €37,43 | `aware_plus` | 16033642316157 |
| beschermd | Eerste 3 maanden korting — Beschermd | `eerste-3-maanden-beschermd` | PROMO-BES | €59,93 | `care` | 16033642381693 |
| alert | Eerste 3 maanden korting — Alert | `eerste-3-maanden-alert` | PROMO-ALE | €29,93 | `secure` | 16033642447229 |
| protect | Eerste 3 maanden korting — Protect | `eerste-3-maanden-protect` | PROMO-PRO | €52,43 | `guard` | 16033642479997 |

Conventions follow the `activation` product (`productType: "service"`, `vendor: "Zo Veilig"`),
not the 3 nami install products, whose vendors are inconsistent import artifacts
(`NAMI EUROPE`, `kur2n3-3a`). Inventory is **untracked** (`inventoryItem.tracked: false`,
`requiresShipping: false`) so they can never go out of stock — the existing fee products are
tracked and have drifted negative (activation sits at −6), which is harmless but noisy.

Prices are resolved in the theme by handle (`all_products[zv_<pkg>_promo_handle]`), never a
hardcoded variant id, same as every other fee product.

## Pricing pipeline changes

`pricing.config.json` gained two fields per purchasable package:

- **`installGroup`** (`nami` / `climax`) — centralizes a classification that previously existed
  only as a hardcoded `case fk` block in `zv-checkout-overview.liquid`. `build_pricing.py` needs
  it to know whether a package gets a 3-option or 1-option due-today breakdown. (The Liquid case
  block still carries its own copy; deduplicating that is a follow-up, not done here.)
- **`promoProduct.productHandle` / `.sku`** — same handle/sku-in-config convention as
  `activation` and `installationOptions.nami.options[]`.

`build_pricing.py` now emits per package a **`dueToday` map, one entry per available install
option** (`install_option_cents + promoDiscountTotalCents`), plus flattened Liquid assigns
(`zv_<pkg>_due_today_<option>[_cents]`, `zv_<pkg>_promo_handle`, `zv_<pkg>_promo_sku`) and the
five previously-unused `labels.*` strings as `zv_label_*`.

`check_pricing.py` gained section 4, which verifies all 8 combinations against the kosten.xlsx
table as hardcoded expectations. The old "due today = activation only" assertions (sections 3
and 7) described the retired model and were replaced; `initialPaymentDueTodayCents` is now the
default/fallback figure (the `huis` option, i.e. before a cheaper nami option is chosen) and
equals `activation + promoDiscountTotalCents` for every package.

**`promoMonthlyCents` / `promoMonthlyDisplay` are now vestigial.** They compute
`monthly × (1 − rate)` — the *retired* "discounted SEPA instalment" idea. The maths is still
correct and still checked, but nothing renders it and nothing should: the monthly rate is never
modified. Flagged in `pricing.config.json`'s `promo.note`.

`labels.commitment` was `"Eerste vooruitbetaling"` — dead text from the v2 1.5× prepayment model
retired in v3.0.0, confirmed unused anywhere in the theme. It now holds the promo row's label,
`"Eerste 3 maanden korting (50%)"`. Noted in `promo.labelCommitmentRepurposed`.

## The itemized breakdown

`zv-checkout-overview.liquid`'s cost card now renders, under `labels.breakdownIntro`:

```
Opbouw van dit bedrag
  Installatie aan huis                €99,00
  Eerste 3 maanden korting (50%)      €37,43
  Vandaag te betalen                  €136,43
Daarna per maand · via SEPA-incasso
  €24,95 per maand.
```

**One row per live cart line**, each read straight off the line it describes, so the rows always
add up to the total — including the rare two-package cart, where naming a single promo row would
silently under-report the charge (caught during validation; the first implementation did exactly
that). The install row uses the chosen option's own label, so a "Geen installatie" cart honestly
shows a €0,00 row rather than hiding it.

The old **"Maand 1 t/m 3 / Maand 4 t/m N" two-tier monthly block is gone** — it varied the
monthly figure, which the confirmed model forbids. "Daarna per maand" is now always the flat
confirmed rate. `zv_promo_active` / `settings.zv_promo_live` no longer gate anything on this
page: the promo is a real line in the cart or it isn't, and the page describes what's actually
there. The merchant-editable promo note is now gated on a promo line being present instead.

Copy that described the retired mechanism ("verrekend in uw maandtermijnen") was corrected in
`promo.disclosure` and in the `before_explainer` / `due_today_text` section-setting defaults.

## Validation performed

- `python3 scripts/build_pricing.py` + `check_pricing.py` — all pass, including the new
  8-combination table.
- `shopify theme check --fail-level error` — 0 errors, 291 warnings (all the pre-existing
  `UndefinedObject`/`UnusedAssign` class `ci.yml` documents for every `zv_*` variable arriving
  through the dynamic `zv-pricing` include; the new `zv_*` variables add more of the same kind,
  no new kind).
- Pushed to disposable theme `zz-validate-prepay-promo-2026-09-22` (#189074866557) and drove
  **real carts** through `shopify theme dev`'s local proxy with curl + a cookie jar, reading the
  actual rendered HTML and `/cart.js` — not just the Liquid source. Theme deleted afterwards.
  - All 8 kosten.xlsx combinations charge exactly the confirmed amount:
    Inzicht/Alert €29,93 / €64,93 / €128,93 · Zeker €37,43 / €72,43 / €136,43 ·
    Beschermd €158,93 · Protect €151,43.
  - Breakdown rows, contract duration and ICV correct for each.
  - Safety gates block checkout (`data-needs-activation` on the root element) for: nami promo
    with no install line, climax promo with no activation, and nami promo carrying only the
    wrong flat climax fee.
  - Two-package cart: commercial-terms rows correctly hidden, monthly correctly sums both
    packages (€44,90), breakdown lists both promo rows and still totals correctly.
  - Full journey: Oplossingen add-to-cart → promo line + flat activation → checkout blocked,
    radio group renders all 3 options → pick Telefonisch → swap zeroes the stray activation and
    adds the choice → €72,43, checkout unblocked, terms correct.
  - `/cart` page renders install + promo lines and "Daarna €24,95 per maand".

**Gotcha for the next session:** grepping the Overzicht HTML for `data-needs-activation`
gives a false positive on every page — the string also appears in the page's own JS. Read the
attribute off the `<div class="zv-overzicht">` root element only. (Same trap
`docs/nami-install-choice-2026-09-21.md` hit from a different angle.)

## The live "Eerste 3 maanden" discount

Full config as it stood before any change (captured 2026-09-22 via Admin GraphQL, since this
session has no browser for a screenshot):

```
id            gid://shopify/DiscountAutomaticNode/2498019852669
type          DiscountAutomaticBasic   title "Eerste 3 maanden"   status ACTIVE
startsAt      2026-09-16T09:32:38Z     endsAt null   createdAt 2026-09-16T09:33:30Z
value         DiscountPercentage 0.5   appliesOnOneTimePurchase true, onSubscription false
combinesWith  order false, product false, shipping false
asyncUsageCount 3
items         DiscountProducts, scoped to 6 PACKAGE products:
              langer-thuis-inzicht, langer-thuis-zeker, langer-thuis-beschermd,
              mijn-thuis-alert, mijn-thuis-protect, mijn-thuis-vista
              (no product variants, no collections)
```

Useful detail the brief didn't have: it is scoped to the **package products only** — not the
installation products, and not the new promo products. So it cannot double-discount the new
line items. It still needs disabling, because a package product reaching checkout by any route
(the standalone product page still sells them) would get 50% off its monthly price, which is
exactly the behaviour this change replaces.

## Not done / follow-ups

1. **The package products are still individually purchasable on the storefront.** Under the new
   model, buying one directly (e.g. `/products/langer-thuis-zeker`) charges the monthly price
   today with no install fee and no promo line, and Overzicht can't identify the package. The
   cart guard's legacy branch still adds the flat activation fee in that case — no worse than
   before, but not a correct prepaid cart either. Fixing it properly is a catalog decision
   (unpublish the package products, or give them a template that can't add to cart), and
   unpublishing would break the `all_products[...]` metafield lookups the matcher and cards
   rely on — so it needs Thijs, not a guess here.
2. **`sections/actie-korting.liquid` + `snippets/zv-actie-card.liquid`** still render a now/was
   monthly price pair (`promo_monthly` vs `monthly`) — the same "discounted monthly rate" idea
   the confirmed model retires. Only the shared `zv_promo_disclosure` text was corrected. The
   page's own price cards need a product decision about what they should show now.
3. **`pricing/pricing.schema.json` is stale** — it still describes the v2 shape (`tiers`,
   `contractTerm`) and doesn't validate the current v3 config. Nothing runs it. Left alone
   rather than half-patched.
4. **`pkg_install_group` is derived twice** — from `installGroup` in the config (build step) and
   from a hardcoded `case fk` block in `zv-checkout-overview.liquid` (render step). They agree
   today; the Liquid side could read the generated value instead.
5. **`assets/oplossingen.js`'s `[data-zv-add-to-cart]` handler is dead code** (the live markup
   uses `data-zv-add`), already flagged in `docs/analytics-tracking-status-2026-09-11.md`. It
   was not updated for the promo model — if it were ever wired up, it would add a package
   product with no fee and no promo line. Worth deleting.
