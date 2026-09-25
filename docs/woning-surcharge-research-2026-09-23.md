# Woning surcharge: research (Prompt 4, spec §7)

> **Superseded in part (2026-09-25):** Woning is now NAMI only and is also collected by one
> priced N0008 cart line; Beschermd and Protect have no Woning. See
> `docs/woning-n0008-line-2026-09-25.md`. The property, its values and its writers below are
> unchanged.

Research for **Prompt 4**, `docs/pakket-wijzigingen-2026-09-23.md` §7 "Woning surcharge", done
before any change on branch `feature/woning-surcharge-2026-09-23`.

- **Researched on:** `origin/main` @ `3c19301` (merge of PR #106, 2026-09-24). Every file:line
  below is on this sha. It supersedes the preflight draft written on `188ce8f`; its line numbers
  are 20–400 lines off after PRs #97–#106.
- **Live theme** (#188704719229, zoveiligdev), pulled read-only on 2026-09-24: byte-identical to
  `3c19301` for `sections/oplossingen.liquid`, `sections/zv-cart.liquid`,
  `sections/zv-checkout-overview.liquid`, `snippets/zv-pricing.liquid`,
  `snippets/zv-item-names.liquid` and `snippets/zv-cart-guard.liquid`. `templates/page.oplossingen.json`,
  `templates/cart.json` and `templates/cart.overzicht.json` are identical as parsed JSON. No
  live-only edits.
- **Decisions D1–D9** are Thijs's (2026-09-24) and are summarised in §9.

---

## 0. Key findings

1. **`Woning` is written only in `sections/oplossingen.liquid`**, by three writers that each write a
   **different** string (§1). Overzicht, Vergelijk pakketten, the pakket-matcher and the cart
   guard never write it. (Spec §7 says "oplossingen.liquid JS ×4, Overzicht": the ×4 counts the
   drawer's set and delete separately; Overzicht writes no line-item properties at all.)
2. **Only two theme surfaces read it**: the Oplossingen cart drawer, which only tests whether it is
   set (`!!p['Woning']`), and `/cart`, which prints every property verbatim. Overzicht, the cart
   guard, analytics and `check_pricing.py` never read it.
3. **The surcharge exists only on the Oplossingen page.** The card price adds it by parsing the
   option's "+€4/mnd" label, and the "Meer informatie" modal adds a hardcoded `+ 400`. The cart
   drawer, `/cart` ("p/m" and "Daarna"), Overzicht ("p/m", "Daarna" and the indicatieve totale
   contractwaarde) and GA4 never include it. Shopify never charges it: it is a property, not a
   priced line, and under CLAUDE.md's "never create products" rule it can't become one.
4. **`pricing.config.json` already has the unit:** `surcharges[extra-etage]`, 400 cents. JS can
   read it from the `#zv-pricing-config` island (`addons[]`, `id: "extra-etage"`), but no theme
   code does. Liquid can't read it: `zv-pricing.liquid` has no assign for it.
5. **Check #10 does not catch the literal "+€4/mnd".** Its price pattern needs two decimals (§4).

---

## 1. Writers of the `Woning` line-item property (all in `sections/oplossingen.liquid`)

| # | Where (3c19301) | Trigger | Value written today |
|---|---|---|---|
| W1 | `readCardOptions()` 1637–1659, value at **1653**; written at **1686** (card add click, 1673–1690) | Card "In winkelwagen" | `Groter dan 100 m² (+€4/mnd per extra verdieping of per 100 m² extra woonoppervlak)`, whichever option in `[data-group="woning"]` is checked |
| W2 | Drawer change handler 1588–1601: set or `delete` at **1597**, `/cart/change.js` at **1599** (with `quantity: line.quantity`, PR #101) | Drawer per-line checkbox `data-zv-line-woning` (rendered at 1467–1470) | `Groter dan 100 m²`, or the key is removed |
| W3 | Modal add/buy handler 1864–1879: `plusChecked` at **1869**, value at **1875** | "Meer informatie" modal checkbox `data-pb-plus` (rendered at 1780–1784), then "In winkelwagen" or "Direct afrekenen" | `Groter dan 100 m² (+€4/mnd per etage)` |

All three go through `addToCart()` (1348–1392) or `cartWrite()` (1411–1418). **`addToCart()` adds the
package only if its variant isn't in the cart yet (1357)**, so a Woning choice made on a card or in
the modal for a package that is already in the cart is dropped silently. After the first add, only
the drawer can change it.

**Add paths that never write `Woning`:** `assets/zv-vergelijk-pakketten.js:244–245` (Vergelijk
pakketten and the embedded pakket-matcher: `Pakket`, `SKU`, `Oplossing`, `Bron` only), and Overzicht,
which writes only the cart attributes `av_akkoord`/`av_akkoord_tijdstip` (`zv-checkout-overview.liquid`
624–633) and swaps installation lines (543–580) without touching package-line properties.

## 2. Readers of `Woning`

| # | Where (3c19301) | What it does |
|---|---|---|
| R1 | `sections/oplossingen.liquid:1455` (`cartRowHtml()`, 1446–1473) | `var woningOn = !!p['Woning'];`. Any non-empty value ticks the drawer checkbox. The value itself is never inspected. |
| R2 | `sections/zv-cart.liquid:92–96` (loop at 94) | Generic tags: every property whose value isn't blank and whose key doesn't contain `_` prints as `Key: value`, so /cart shows the raw string, e.g. `Woning: Groter dan 100 m² (+€4/mnd per extra verdieping …)`. No amount, no control. |
| R3 | Dawn renderers: `sections/main-order.liquid:63–80` (customer account order page, `templates/customers/order.json`), `sections/main-cart-items.liquid:148`, `snippets/cart-drawer.liquid:195`, `sections/cart-notification-product.liquid:29` | Print every non-`_` property. Only main-order is on a live path; `/cart` uses `zv-cart` and `cart_type` is `notification` (`config/settings_data.json:119`). Not changed. |
| R4 | Shopify checkout, order admin, order e-mails (outside the theme) | *Inferred from standard Shopify behaviour, not tested:* show non-`_` properties verbatim. |

**Checked, and they don't read it:**
- `sections/zv-checkout-overview.liquid`: no `properties` reference anywhere.
- `snippets/zv-cart-guard.liquid`: never reads properties. Rule 2 (99–111; duplicates at 102–105) removes the **second**
  line of the same package variant and keeps the first in cart order, whatever properties either has.
- Analytics: `assets/zv-measurement.js`, `assets/zv-track.js`, `assets/oplossingen.js` (§6).
- Also no hits: `sections/vergelijk-pakketten.liquid`, `snippets/zv-pakket-matcher.liquid`,
  `assets/zv-vergelijk-pakketten.js`, the other `snippets/*`, `blocks/*`, `locales/*`, `config/*`,
  `layout/*`, `supabase/**`, `scripts/*`.

## 3. Customer-visible Woning copy (not the property)

| Where (3c19301) | Text today |
|---|---|
| `oplossingen.liquid:347–350`: ltc cards (Inzicht, Zeker, Beschermd, Alert, Protect), `<details class="ltc__uitbreidingen">` panel (344–378), first `.ltc__optgroup` | heading `Woning groter dan 100 m²?`; one checkbox `Ja, per extra verdieping of 100 m² extra`, price `+€4/mnd` |
| `oplossingen.liquid:416–434` (Woning at 417–420): tile branch `.pcard--tile` | summary `Woning groter dan 100 m²?`; checkbox `Ja, per extra etage` `+€4/mnd`. **Dead code:** the only tile-branch product is Vista, and 179 forces `price_known = false` for it. Byte-identity extract E08 covers it. |
| `oplossingen.liquid:1467–1470`: drawer row | `aria-label="Woning groter dan 100 m² voor <pakket>"`, label `Woning groter dan 100 m²`, price `+€4/mnd` |
| `oplossingen.liquid:1780–1784`: modal box `.pbd-plus` | `Woning groter dan 100 m²`, `pk.plus.price`, `Per extra etage: <items>` |
| `oplossingen.liquid:684–689`: `#opl-modal-data` (661–694), `"plus"` per package | `"price":"+€4 p/m"` on all six. Items: aware/aware_plus `["1 sensor","2 pluggen"]`; care `["1 rookmelder","2 magneetcontacten en 1 locatiesensor"]`; secure `["1 SensePlug","1 sensor"]`; guard `["1 fotobewegingsmelder","1 deurcontact"]`; secure_plus (Vista, E09, `noPrice`) `["1 PIR","1 deurcontact"]`. |
| `oplossingen.liquid:469–472`: grid footnote under `langer-thuis` and `mijn-thuis` (comment at 469) | `Alle abonnementen: +€4/mnd per extra verdieping of per 100 m² extra woonoppervlak. …` |
| `pricing/pricing.config.json:299–311` | `surcharges[extra-etage]`: `name` "Per extra etage", `description` "Alle abonnementen: +€4 p/m per extra etage.", 400 cents. No surface reads name or description. |

Both `pak_sub` texts in `templates/page.oplossingen.json` (29 and 62) no longer mention the
surcharge (Prompt 1). Unrelated "~100 m²" sensor-coverage copy (`oplossingen.liquid:152, 665, 684,
685`, `pricing.config.json:174`, `assets/zv-finder.js:30`) is not part of this.

## 4. How the +€4/mnd reaches price displays today

| Surface | Includes it? | Mechanism (3c19301) |
|---|---|---|
| Card price `.pcard__price .amt` | Yes, client-side | `recomputeCardPrice()` 1237–1249 adds `euroToCents()` (1234) of every checked option whose `.pcard__plus-pr` text contains `+`; "+€4/mnd" parses to 400. Called from the page `change` handler (1662–1671). |
| Modal price `[data-pb-amt]` | Yes, hardcoded | 1883–1890: `fmtCents(base + 400)` at 1889. |
| Drawer line price | No | 1459: `shown = it.original_price` for every non-CL003 line, shown with "/mnd" (1464). |
| `/cart` line "p/m" | No | `zv-cart.liquid:110`: `item.original_price`. |
| `/cart` "Daarna … per maand" | No | 144 sums `item.original_price` of the package lines, printed at 160. |
| `/cart` "Vandaag te betalen" | No (correct: not charged) | Sum of `final_line_price` (129). |
| Overzicht line "p/m" | No | `zv-checkout-overview.liquid:317`: `item.original_price`. |
| Overzicht "Daarna …/mnd" | No | 131 sums `item.original_price`; row at 424. |
| Overzicht indicatieve totale contractwaarde | No | `pkg_icv` from `zv_*_icv` (183–219), adjusted only for the NAMI install choice (234–239), shown at 432. `pkg_icv_cents_base` is set only for the three NAMI packages. |
| Shopify checkout total | No | Not a priced line. |
| GA4 | No | §6. |

**Check #10 and the literal.** `scripts/check_pricing.py:288` matches `€\s*\d+[.,]\d{2}`, so it only
sees amounts with two decimals. "+€4/mnd", "+€4 p/m" and "+€8/mnd" pass by omission; there is no
allowlist. It would catch "€4,00". `snippets/zv-pricing.liquid` is excluded from the scan (261), and
check #9's retired patterns don't cover it either.

## 5. The `extra-etage` unit: reachability

- `scripts/build_pricing.py:247` merges `cfg["surcharges"]` into the generated `addons[]`, so
  `pricing.generated.json` and the `#zv-pricing-config` island (`snippets/zv-pricing.liquid:9`)
  carry `{"id":"extra-etage","priceCents":400,…}`.
- **JS on Oplossingen: reachable.** `{%- include 'zv-pricing' -%}` (34) renders the island, and the
  page already parses it for `PKG_QTY`/`PKG_BY_FK` (1322–1339), which reads only `promo` and `packages`.
- **Liquid (card markup, footnote, `/cart`, Overzicht): not reachable.** `zv-pricing.liquid` assigns
  (12–142) cover promo, activation, labels, names, order, NAMI install options and packages only, and
  Liquid can't parse the island. The only non-hardcoded path is for `build_pricing.py` to emit
  assigns, then regenerate. CI's "Fail if generated files are stale" step
  (`.github/workflows/ci.yml`) requires the regenerated files to be committed.
- `pricing/pricing.schema.json` is not validated by CI or any script, and is already stale.

## 6. Analytics / GA4 today (D9: unchanged)

Nothing sent today identifies the Woning choice or includes its amount:
- `add_to_cart` (`oplossingen.liquid:1370–1374`): item id/name/brand, `price` = config
  `monthlyRecurringPriceCents / 100` (no surcharge), `quantity: 1`. No Woning field.
- `view_cart` / `begin_checkout` (`assets/zv-track.js:108, 146, 154`): `value` = `cart.total_price`,
  which a property can't change; items from `mapCartItems()` (90–101), which never reads properties.
- `package_option_select` (`fire()`, `oplossingen.liquid:1182–1185`, called at 1670 with the
  option's label text): **sends nothing.** `fire()` calls `ZVMeasurement.track`, which no theme file
  defines (`assets/zv-measurement.js:288–316` exports `push`, `packageOptionSelect` and others, not
  `track`). GTM could define it; the repo can't show that.
- The add buttons carry `data-selected-term`/`data-selected-addon` (set at 1668), no Woning
  attribute.
- Shopify's own checkout events can carry line-item properties to a pixel/app outside the theme;
  not verifiable from the repo.

## 7. Legacy values

Carts opened before this change can hold any of the three W1–W3 strings. All start with
`Groter dan 100 m²`. D1: match by that prefix and read it as the 1-verdieping option. Nothing
migrates the stored value; it stays in the cart (and reaches Odoo) until the customer picks again in
the drawer. The preflight (2026-09-23, read-only Admin API) found no order carrying `Woning`; not
re-queried here.

## 8. Critic notes, re-checked on 3c19301

- **`hydrateLineOptions()` copies card groups into the drawer** (1482–1510): only
  `[data-group="addons"]` and `[data-group="terms"]`, never `woning`. PR #106's button styling is
  scoped to `.pcard .ltc__cta`, so the clones keep their own rules (1079–1087). The drawer's Woning
  control is its own markup (1467–1470), not a clone; this branch keeps it that way.
- **Every non-CL003 drawer line gets a Woning checkbox** (1467: `isActivation ? '' : …`,
  `isActivation` at 1456 matches CL003 only). NAMI installation lines (N0004/N0005/N0006), which
  Overzicht adds, get one too. Found by reading the code, not reproduced. Once Woning carries
  amounts on `/cart` and Overzicht, a control on a line that no reader counts would be worse, so
  this branch shows the control only on lines whose package card offers Woning.
- **`zv-cart.liquid:94` hides any property key containing `_` anywhere**, not only a leading one.
  `Woning` has none; this branch uses no hidden keys. Listed in §11.
- **Order #1009 has two `LT-ZEK` lines with different property sets** (modal path with `Platform`,
  card path without; preflight Admin API read). The guard now removes the second line (rule 2), so
  the Woning of the first line wins. Listed in §11.

## 9. Decisions (Thijs, 2026-09-24) and what this branch changes

**D1 values.** Exactly `1 extra verdieping of 100 m²` and `2 extra verdiepingen of 200 m²`, no price
in the value. Legacy values (prefix `Groter dan 100 m²`) read as option 1.

**D2 UI.** Two checkboxes that uncheck each other (native deselect, keyboard included), each with
its price from config (400 and 2 × 400 cents) formatted like the add-on prices (`money`, "+…/mnd").
Check #10 must keep passing (§4).

**D3 amounts.** Not charged today ("Vandaag te betalen" unchanged). Odoo bills it from month 4, so
every monthly-after amount adds unit × floors, and the contract value adds
unit × floors × (termMonths − 3):

| Package | Term | Monthly | + option 1 | + option 2 | Contract value + option 1 | + option 2 |
|---|---|---|---|---|---|---|
| Inzicht | 12 | €19,95 | €23,95 | €27,95 | +€36,00 | +€72,00 |
| Zeker | 12 | €24,95 | €28,95 | €32,95 | +€36,00 | +€72,00 |
| Beschermd | 36 | €39,95 | €43,95 | €47,95 | +€132,00 | +€264,00 |
| Alert | 12 | €24,95 | €28,95 | €32,95 | +€36,00 | +€72,00 |
| Protect | 36 | €37,95 | €41,95 | €45,95 | +€132,00 | +€264,00 |

**Every monthly-after or contract-value amount shown for a cart line** (all get the surcharge):
1. Oplossingen drawer line price "/mnd" (`oplossingen.liquid:1459/1464`).
2. `/cart` package line "p/m" (`zv-cart.liquid:110`).
3. `/cart` "Daarna … per maand" (`zv-cart.liquid:144/160`).
4. Overzicht package line "p/m" (`zv-checkout-overview.liquid:317`).
5. Overzicht "Daarna …/mnd" (`zv-checkout-overview.liquid:131/424`).
6. Overzicht indicatieve totale contractwaarde (`zv-checkout-overview.liquid:183–239/432`).

The pre-cart displays already include it and keep doing so: the card price (`recomputeCardPrice()`)
and the modal price. Not cart-line surfaces, so unchanged: the actie page, pakket-matcher,
Vergelijk pakketten and Keuzehulp monthly prices (config package prices), and Dawn's main-order
(charged amounts only).

**D4 build.** `build_pricing.py` emits the unit, both options and each package's surcharge
contract values into `pricing.generated.json` (a `woning` block and `packages[].woningContractValue`)
and `snippets/zv-pricing.liquid` (`zv_woning_*`, `zv_<pakket>_woning_<n>_icv_cents`). The option
values and the heading go into `surcharges[extra-etage].woning` in `pricing.config.json`, so the
card, drawer, modal, `/cart` and Overzicht share one source; the amount stays the existing 400.
`check_pricing.py` gets a Woning section: unit 400, values exactly as D1, monthly 400/800, contract
value €36/€72 at 12 months and €132/€264 at 36 months, checked against each package's termMonths.

**D5 modal.** Same two options and values, prices from config, and the price updates to
base + unit × floors. "Per extra etage: …" becomes "Per extra verdieping: …" with the item lists
kept; Alert's "1 SensePlug" becomes "1 activiteiten sensor". The now-unused `"price":"+€4 p/m"` is
dropped from the five buyable entries. The Vista entry (`secure_plus`, E09) is not touched.

**D6 Overzicht type label.** `zv-checkout-overview.liquid:305` prints `item.product.type`; CL003
shows "ALL". Installation lines (CL003 and N0004/N0005/N0006, by the section's
`activation_variant_id` and `nami_install_*_variant_id`) show "Installatie"; other lines keep the
type.

**D7 drawer.** Same two options; legacy value reads as option 1; `quantity: line.quantity` stays in
both `/cart/change.js` calls; the rest of the drawer, the cart guard and the Overzicht click re-check
are not touched. The control shows only for lines whose package card has a Woning group (§8).

**D8 tile copy.** Unchanged, byte-identical (E08). The JS reads its single checkbox, which has no
level attribute, as option 1.

**D9 analytics.** Unchanged (§6).

**Footnote.** It doesn't contradict the options ("per extra verdieping of per 100 m²"), so the
wording stays. Only its amount comes from config now, rendered as before ("+€4/mnd").

**How the unit reaches each place after this branch:**
- Liquid (card labels, footnote, `/cart`, Overzicht): `zv_woning_*` and `zv_<pakket>_woning_<n>_icv_cents`
  from `zv-pricing.liquid`. `/cart` and Overzicht read a line's level through a new
  `snippets/zv-woning-floors.liquid` (values and legacy prefix passed in, since `render` doesn't
  share scope).
- JS (drawer, modal, card add): the `woning` block of the `#zv-pricing-config` island.
- Card price: `recomputeCardPrice()` still parses the option's price text, now rendered from config.

## 10. Odoo (flagged, not solved)

- Odoo must recognise the two new values on the package line's `Woning` property,
  `1 extra verdieping of 100 m²` and `2 extra verdiepingen of 200 m²`, and bill +€4,00/+€8,00 per
  month from month 4 (D3 assumes this; the theme can't check it).
- Orders from carts opened before the deploy can still carry the legacy strings (§7):
  `Groter dan 100 m² (+€4/mnd per extra verdieping of per 100 m² extra woonoppervlak)`,
  `Groter dan 100 m²` and `Groter dan 100 m² (+€4/mnd per etage)`. They mean 1 floor.
- A legacy `Woning` can also sit on a NAMI installation line (old drawer, §8); Odoo should ignore it
  there.
- The repo shows no Odoo mapping for `Woning` (no order handler in `supabase/functions/`, no
  property column in `commerce_orders`/`order_lines`), and `unresolved[]` has no entry for it.

## 11. Adjacent items (not changed here)

1. `addToCart()` adds a package only if it isn't in the cart (1357): a Woning choice on the card or
   in the modal for a package already in the cart is dropped. Only the drawer can change it then.
2. The drawer shows a NAMI installation line's price with "/mnd" (`isActivation` matches CL003 only).
3. `/cart` prints the product type above each line too (`zv-cart.liquid:88`); CL003 shows "ALL" there.
   D6 covers Overzicht only.
4. Check #10 misses integer-euro literals. The ones left after this branch are in byte-identical
   code: the tile copy (E08, "+€4/mnd") and Vista's modal entry (E09, "+€4 p/m"). Tightening the
   check needs exemptions for both.
5. `zv-cart.liquid:94` hides every property key containing `_`, not only a leading one.
6. `pricing/pricing.schema.json` is stale and unvalidated; it doesn't describe
   `surcharges[].woning` either.
7. The config's `extra-etage` `name`/`description` still say "etage"; nothing displays them.
8. `fire()` / `package_option_select` sends nothing (§6).
9. Cart-guard rule 2 keeps the first of two lines for the same package; a Woning on the second line
   is lost (order #1009 shows such duplicates happen).
10. A legacy `Woning` on a NAMI installation line stays visible as a raw tag on `/cart`, counts
    nowhere, and has no control to remove it except removing the line.
11. The footnote gives no upper bound; the options stop at 2 floors / 200 m². Saying so needs new
    copy, not added here.

## 12. Verified vs inferred

**Verified** (reading `3c19301`, the read-only live pull, `shopify theme check`): every file:line
above, the three written strings, that Overzicht and the guard read no properties, that
`ZVMeasurement.track` is undefined, that `extra-etage` = 400 is in the island's `addons[]` with no
Liquid assign, the check #10 pattern, and live = `3c19301` for the files above.

**Inferred, not tested:** Shopify checkout, admin and e-mails show non-`_` properties verbatim; a
NAMI installation line gets the old drawer checkbox (code path read); anything about Odoo; the
preflight's order counts (not re-queried).
