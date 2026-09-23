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

`pricing.config.json` gained three fields per purchasable package:

- **`installGroup`** (`nami` / `climax`) — centralizes a classification that previously existed
  only as a hardcoded `case fk` block in `zv-checkout-overview.liquid`. `build_pricing.py` needs
  it to know whether a package gets a 3-option or 1-option due-today breakdown. (The Liquid case
  block still carries its own copy; deduplicating that is a follow-up, not done here.)
- **`promoProduct.productHandle` / `.sku`** — same handle/sku-in-config convention as
  `activation` and `installationOptions.nami.options[]`.
- **`productHandle`** (the package's own Shopify handle, added 2026-09-23) — the cart guard
  needs it to recognize a stray package line. The Cart AJAX API exposes a line's `handle`
  but not its metafields, so handle is the only usable key there.

`build_pricing.py` now emits per package a **`dueToday` map, one entry per available install
option** (`install_option_cents + promoDiscountTotalCents`), plus flattened Liquid assigns
(`zv_<pkg>_due_today_<option>[_cents]`, `zv_<pkg>_promo_handle`, `zv_<pkg>_promo_sku`) and the
five previously-unused `labels.*` strings as `zv_label_*`.

`check_pricing.py` gained section 4, which verifies all 8 combinations against the kosten.xlsx
table as hardcoded expectations. The old "due today = activation only" assertions (sections 3
and 7) described the retired model and were replaced; `initialPaymentDueTodayCents` is now the
default/fallback figure (the `huis` option, i.e. before a cheaper nami option is chosen) and
equals `activation + promoDiscountTotalCents` for every package.

**`promoWasCents` / `promoWasDisplay`** (added 2026-09-23) are `monthly × promo.months` —
what the prepaid period is worth undiscounted, i.e. the struck-through figure on the actie
page. A 3-month total, never a monthly rate, so it must never be rendered with "/mnd".

**`promoMonthlyCents` / `promoMonthlyDisplay` were removed** on 2026-09-23. They computed
`monthly × (1 − rate)` — the *retired* "discounted SEPA instalment" idea. Once the actie card
stopped using them, nothing consumed them, so they are gone from the generated output and
`check_pricing.py` now asserts they stay gone.

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
installation products, and not the new promo products. So it could not have double-discounted
the new line items. It still needed disabling, because a package product reaching checkout by
any route (the standalone product page still sells them) would get 50% off its monthly price,
which is exactly the behaviour this change replaces.

**Disabled 2026-09-23**, with Thijs's go-ahead in-session. An automatic discount has no status
field to flip — `status` is derived from `startsAt`/`endsAt` — so it was expired by setting
`endsAt` to `2026-09-23T07:01:00Z` via `discountAutomaticBasicUpdate`. It now reports
`status: EXPIRED`, with `asyncUsageCount` still 3 (the orders it already applied to are
untouched). **To reverse:** set `endsAt` back to `null` on the same discount id; nothing else
about it was changed.

## Copy changes for review

Every customer-visible string this branch changed, before and after. All of it is Dutch
copy on the Overzicht page, the actie page and the package product pages.

**`promo.disclosure`** (rendered on the actie page under the cards, as `zv_promo_disclosure`)

- before: "Indicatief. De eerste 3 maanden ontvangt u 50% korting op het maandbedrag,
  verrekend in uw maandtermijnen. Alle bedragen zijn inclusief btw (21%)."
- after: "De eerste 3 maanden betaalt u vooruit met 50% korting, eenmalig bij uw
  bestelling. Daarna betaalt u het vaste maandbedrag via SEPA-incasso. Alle bedragen zijn
  inclusief btw (21%)." *(wording supplied verbatim by Thijs, 2026-09-23)*

**`labels.commitment`** (the promo row's label in the Overzicht breakdown)

- before: "Eerste vooruitbetaling" *(dead v2 prepayment label, rendered nowhere)*
- after: "Eerste 3 maanden korting (50%)"

**`before_explainer`** section-setting default (Overzicht, under the cost card)

- before: "De eerste 3 maanden ontvangt u 50% korting op het maandbedrag, verrekend in uw
  maandtermijnen. Alle bedragen zijn inclusief btw (21%)."
- after: "De korting van de eerste 3 maanden rekent u vandaag ineens af, naast de
  installatiekosten. Uw maandbedrag zelf verandert niet. Alle bedragen zijn inclusief btw
  (21%)."

**`due_today_text`** section-setting default (Overzicht, under "Opbouw van dit bedrag")

- before: "Vandaag betaalt u de eenmalige kosten voor activatie en installatie via de
  beveiligde Shopify-checkout."
- after: "Vandaag betaalt u de eenmalige kosten voor activatie en installatie plus de
  vooruitbetaalde korting voor de eerste 3 maanden, via de beveiligde Shopify-checkout."

**Overzicht cost card** — the collapsed total and the two-tier monthly block were replaced
by the itemized list (see above). The "Maand 1 t/m 3 / Maand 4 t/m N" rows are gone.

**Actie page card** (`snippets/zv-actie-card.liquid`)

- before: `€ 12,48 /mnd` with `€ 24,95` struck through — a discounted *monthly* rate.
- after, as rendered and verified:
  ```
  Eerste 3 maanden:  €74,85  €37,43  eenmalig vandaag
  Daarna €24,95/mnd
  ```
  The discounted figure carries no "/mnd": it is a 3-month total. Per package the struck
  figure is €59,85 (Inzicht/Alert), €74,85 (Zeker), €119,85 (Beschermd), €104,85
  (Protect). Vista is unchanged ("Op maat", no promo block).

**Package + promo product pages** (`sections/main-product.liquid`) — the add-to-cart form
is replaced by a single CTA reading **"Kies uw pakket"**, linking to
`/pages/oplossingen?pakket=<finder_key>`.

Two strings were reviewed and deliberately left alone: the actie page hero ("De eerste
maanden betaalt u nog maar de helft, daarna gewoon het vaste maandbedrag") is still
accurate under this model, and the static "Onze monteur neemt na uw bestelling contact op"
line under the Overzicht cost card remains the pre-existing copy flagged in
`docs/nami-install-choice-2026-09-21.md`.

## Not done / follow-ups

Items 1 and 2 below were resolved on 2026-09-23 (Thijs's decisions); kept here with their
outcome so the history reads straight.

1. ~~The package products are still individually purchasable on the storefront.~~
   **Closed 2026-09-23.** The products stay published (the `all_products[...]` lookups
   depend on it), but `sections/main-product.liquid` no longer renders a buy form for any
   product carrying `custom.finder_key` — packages and promo products alike — showing a
   "Kies uw pakket" CTA to `/pages/oplossingen?pakket=<finder_key>` instead. The cart guard
   now also swaps a stray package line for that package's promo line rather than letting it
   be charged. The 5 promo products additionally carry `seo.hidden = 1` and belong to no
   collection, so they don't surface in search or collection listings.
2. ~~`actie-korting.liquid` + `zv-actie-card.liquid` still render a now/was monthly pair.~~
   **Closed 2026-09-23.** The cards now show the prepaid 3-month total against its
   undiscounted worth, plus the unchanged monthly rate underneath (see "Copy changes for
   review"). `promoMonthlyCents`/`promoMonthlyDisplay` were removed from the generated
   output once this was the last consumer; `check_pricing.py` asserts they stay gone.
   Note the actie template has **no Shopify page pointing at it** — `page.actie.json`
   exists but no page uses the `actie` suffix, so the page is not reachable on the
   storefront. It was validated by creating a temporary page and deleting it afterwards.
   Someone needs to create the real page when the campaign goes live.
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
6. **Shop Pay's installments form remains on package product pages.** With the buy form
   gone, Dawn still renders the `payment_terms` messaging form (`<form action="/cart/add"
   class="installment">`) from the price block. It has no submit control and can't add to
   cart, but it is the one `/cart/add` form left on those pages. Harmless as far as tested;
   worth removing for tidiness if the price block is ever touched.
