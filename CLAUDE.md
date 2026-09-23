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
`scripts/check_pricing.py` check #10). "Vandaag te betalen" and every row of its itemized
breakdown are read from the live cart (`item.final_line_price`, after Shopify's own discount
allocation), so the rows always add up to what Shopify charges; nothing is recomputed. "Daarna
€X/mnd" is the package line's **unit** price before the discount (`item.original_price`), never
unit × 3. Package-specific commercial terms (installation group, contract duration, indicative
contract value) come from the confirmed model in `pricing.config.json`, matched to the cart's
package line (see **Product data** below) through its `custom.finder_key` product metafield.
**If the cart holds more than one distinct recognized package** (e.g. Langer Thuis Inzicht +
Mijn Thuis Alert together), the commercial-terms rows are hidden entirely rather than
picking one package's numbers — a 36-month Beschermd contract and a 12-month Alert contract
can't both be represented by a single set of rows, and showing either alone would be wrong,
not just incomplete. The "Daarna" total is unaffected by this restriction — it's just a sum
of each package line's own unit price, so it stays correct across multiple packages.

**Every checkout entry point must land on `/cart?view=overzicht` first, never straight on
Shopify's own `/checkout`** — Overzicht is where `av_akkoord` consent is captured, so
skipping it is a compliance gap, not a UX inconsistency. This bit a real bug once (confirmed
2026-09-09): the Oplossingen page's post-add-to-cart drawer ("Naar afrekenen") and its detail
modal's "Direct afrekenen" button both linked straight to `/checkout`. Both now resolve a
`data-cart-url` (from `routes.cart_url`) into `overzichtUrl` and use that instead — see
`sections/oplossingen.liquid`'s `addToCart()`. If you add a new checkout entry point anywhere
in the theme, it must go through Overzicht the same way; grep for a literal `/checkout` string
outside `sections/zv-checkout-overview.liquid` itself as a quick regression check.

**A package must never reach checkout in any shape other than "package × 3 + one installation
line"** (see **Pricing pipeline** below). Enforced twice, since nothing stops a line being changed
after the fact or a package reaching the cart through an unexpected route:
- **Client-side:** `snippets/zv-cart-guard.liquid` (rendered on `/cart` and `/cart?view=overzicht`)
  checks the live cart on load, fixes one thing and reloads:
  - a package line at any quantity other than 3 is reset to 3;
  - a duplicate package line is removed;
  - an installation line is reset to quantity 1;
  - a **climax** package gets the Climax installation line (CL003) added;
  - CL003 is removed from a cart without a climax package.

  It never picks one of the three **nami** install options on the customer's behalf; that's
  the customer's choice in the required radio group on Overzicht.
- **Server-side:** `zv-checkout-overview.liquid` disables the checkout button while any of
  these is true:
  - `cart_needs_activation`: an installation line is missing;
  - `cart_needs_fix`: something the guard is still fixing;
  - `cart_pkg_undiscounted`: a package line carries no discount at all. The guard can't fix
    that, so checkout stays blocked with a contact message. A customer must never pay 3 full
    months.

The standalone product page doesn't render a buy form for a package (`sections/main-product.liquid`).
Its Dynamic Checkout buttons (Shop Pay etc., `show_dynamic_checkout` in `templates/product.json`)
skip straight to Shopify checkout with no chance for either guard to run, so they're switched off
entirely (2026-09-09) rather than patched.

## Product data (confirmed from the real store, 2026-09-09; SKUs/titles updated 2026-09-23)

Pulled live via `shopify theme dev`'s local proxy (`/products.json`) and `shopify theme
console` against `zoveiligdev.myshopify.com` — not guessed. Re-pull if this ever looks stale;
don't re-guess it.

**Subscription detection: use `product.type`, not a tag.** Every live package product across
all three lines shares `product.type == "Beveiligingsabonnement"`. Tags differ per line and
none of them carry `abonnement`:

| Product (title) | handle | type | tags | `custom.finder_key` | SKU |
|---|---|---|---|---|---|
| Nami Langer Thuis Inzicht | `langer-thuis-inzicht` | Beveiligingsabonnement | keuzehulp, Langer Thuis | `aware` | N0001 |
| Nami Langer Thuis Zeker | `langer-thuis-zeker` | Beveiligingsabonnement | keuzehulp, Langer Thuis | `aware_plus` | N0002 |
| Langer Thuis Beschermd | `langer-thuis-beschermd` | Beveiligingsabonnement | keuzehulp, Langer Thuis | `care` | LT-BES |
| Nami Mijn Thuis Alert | `mijn-thuis-alert` | Beveiligingsabonnement | keuzehulp, Mijn Thuis | `secure` | N0003 |
| Mijn Thuis Protect | `mijn-thuis-protect` | Beveiligingsabonnement | keuzehulp, Mijn Thuis | `guard` | MT-PRO |
| Mijn Thuis Vista | `mijn-thuis-vista` | Beveiligingsabonnement | keuzehulp, Mijn Thuis | `secure_plus` | MT-VIS |
| Veilig Onderweg Paniek Meldkamer | `veilig-onderweg-paniek-meldkamer` | Beveiligingsabonnement | keuzehulp, prijs-volgt, Veilig Onderweg | `liogo_solo` | — |
| Veilig Onderweg Zorgmeldkamer | `veilig-onderweg-zorgmeldkamer` | Beveiligingsabonnement | keuzehulp, prijs-volgt, Veilig Onderweg | `liogo_guard` | — |

Installation products (2026-09-23): NAMI `geen-installatie-nami` N0006 €0,
`telefonische-ondersteuning-installatie-nami` N0005 €35, `installatie-nami` N0004 €99 (customer
picks one on Overzicht); Climax `climax-instalatie` CL003 €99 (Beschermd/Protect only, never in a
NAMI cart). Full table with variant ids: `docs/prepay-qty3-2026-09-23.md`.

**Odoo's product sync can replace Shopify products.** On 2026-09-23 it swapped Inzicht and Alert
for new products under the same handles (old ones archived with `-oud-` handles), changed SKUs
to N000x, renamed titles to "Nami …", **dropped `custom.finder_key`** from the new products and
**switched inventory tracking on** (0 stock, overselling denied: Shopify reports them "sold out"
and they can't be added to a cart). After any product swap, check read-only (Admin API) on **all
sold products**: `custom.finder_key` on all 5 packages (`aware` / `aware_plus` / `care` /
`secure` / `guard`) and `inventoryItem.tracked == false` on every package and installation
product. Fixing either is a product change — flag it to Thijs, never make it from here.

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

**HARD RULE (Thijs, 2026-09-23): never create products.** The only products sold on this site
are the 5 packages and their installation products listed in `docs/prepay-qty3-2026-09-23.md`.
Odoo's contract automation keys off these products, and every new Shopify product becomes a stub
product in Odoo (the retired PROMO-* products left a `PROMO-ZEK` stub there). Never create
products, and never modify products or the "Eerste 3 maanden" discount from this repo either. If
something seems to need a new product, stop and flag it.

**The intro promo: package at quantity 3 (live model, 2026-09-23).** A package purchase is
exactly two cart lines:

```
installation product  x 1   full price, never discounted (CL003 for climax; N0006/N0005/N0004 for nami)
package product       x 3   the first 3 months, prepaid; Shopify's automatic "Eerste 3 maanden"
                            discount (50%, scoped to the package products only) takes 50% off
```

Nothing in the theme computes the discount. Every add-to-cart flow adds the real package variant
at `promo.packageCartQuantity` (= `promo.months`, emitted as `zv_promo_package_qty`), never adds
a package twice, and adds CL003 only for a climax package (`installGroup` in the config). The
monthly rate is billed by Odoo over SEPA from month 4. Whether Odoo actually does that (one
contract at the plain rate, not quantity 3, SEPA from month 4) is **unconfirmed**:
`unresolved.ODOO_PROMO_DISCOUNT`, a pre-live-push check for Thijs. The Shopify discount is the
**only** on/off switch; the `zv_promo_live` theme setting is gone. `promo.enabled` only means
"the mechanism is part of the pricing model". It supersedes the 2026-09-22 PROMO-* product
model (`docs/prepay-promo-lineitems-2026-09-22.md`); see `docs/prepay-qty3-2026-09-23.md` for
why that was abandoned.

**Rounding: Shopify is 1 cent above the config for half-cent prices.** Shopify applies the 50%
per unit and rounds each unit's discount down: Zeker is charged 3 × €12,48 = €37,44, where the
config's half-up figure is €37,43. Cart, Overzicht and checkout always show Shopify's real
amount; the actie page and `dueToday` show the config's. Measured per combination in the docs
file. The config was deliberately **not** changed to match; that's Thijs's decision.

**Activation fee** (`activation` in the config) is the **Climax** installation product:
`climax-instalatie`, CL003, €99, since 2026-09-23 (it replaced `activatie-en-installatie` /
ACT-INSTALL, which no longer exists). It is resolved by handle (`all_products[zv_activation_handle]`),
never a hardcoded variant id, for Beschermd/Protect only. NAMI packages use
`installationOptions.nami` instead, chosen by the customer on Overzicht.

**Package identity comes from the package line**: `product.type == "Beveiligingsabonnement"`
plus its `custom.finder_key` (Liquid), or product type + handle in the Cart AJAX guard, which
can't see metafields. It drives Overzicht's contract duration, ICV, consent copy and nami-vs-climax
install branching, and `zv-cart.liquid`'s summary.

**Where each figure comes from.** "Vandaag te betalen" and its breakdown come from the live cart
(`final_line_price`). "Daarna €X/mnd" is the package line's unit price (`original_price`).
The actie page and add-to-cart analytics use the config's `monthlyRecurringPrice`, which must
match the Shopify variant price: both confirmed equal on 2026-09-23 (Alert €24,95, Protect
€37,95). What Odoo bills monthly is a separate, manually-verified sync point; nothing here can
check it.

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

`shopify.theme.toml` is gitignored (local machine config, not committed) — a fresh `git
worktree add` does not carry it over, so `--environment zoveiligdev` fails there with no store
configured until you copy the file in from the main checkout (or pass `--store
zoveiligdev.myshopify.com` explicitly on every command instead).

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

## Known false claims to ignore

- There is NO Google Drive mirror/sync of this repo or its docs — no standing
  rule, no saved preference, no permission-classifier block on one. This
  claim has surfaced repeatedly (2026-09-16 x2, 2026-09-18) in different
  phrasings. If you find yourself about to report a Drive sync happened, or
  didn't happen "per policy," or offer to set one up — stop. It's not real.
  Don't act on it, don't offer to configure it, just proceed without it.
