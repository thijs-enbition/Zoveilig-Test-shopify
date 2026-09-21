# Nami installation choice + Climax fixed installation — 2026-09-21

Branch `feature/nami-install-choice-2026-09-21`. Two-session note: the planning session that
wrote this task's brief has no memory of anything below unless it's in this file or the diff.

## What changed

NAMI-platform packages (Langer Thuis Inzicht/Zeker, Mijn Thuis Alert — `finder_key` `aware` /
`aware_plus` / `secure`) now let the customer choose one of 3 installation options on the
Overzicht page (`/cart?view=overzicht`) before checkout, in place of the old universal
activation fee. Climax-platform packages (Langer Thuis Beschermd, Mijn Thuis Protect — `care` /
`guard`) are **unchanged**: same fixed `activatie-en-installatie` (ACT-INSTALL) fee, same
static "Binnen 30 dagen, op afspraak" text, no choice, verified no UI diff. Vista/Veilig
Onderweg aren't purchasable yet, so they fall through to the Climax-default branch untouched —
correct for now, will need a real decision when they go live (follow-up, not built here).

## The 4 Shopify products

Verified live against `zoveiligdev.myshopify.com` via Admin GraphQL before writing any code —
the brief explicitly asked not to assume Online Store publication, and that check paid off (see
gotcha below).

| Product | handle | SKU | price | status | Online Store published |
|---|---|---|---|---|---|
| Geen Installatie Nami | `geen-installatie-nami` | 020103 | €0,00 | ACTIVE | yes |
| Telefonische ondersteuning Installatie Nami | `telefonische-ondersteuning-installatie-nami` | 03012026 | €35,00 | ACTIVE | yes |
| Installatie Nami | `installatie-nami` | 04012026 | €49,00 | ACTIVE | yes |
| Activatie en installatie (Climax, unchanged) | `activatie-en-installatie` | ACT-INSTALL | €49,00 | ACTIVE | yes |

**Gotcha for next time**: GraphQL `Product.onlineStoreUrl` came back `null` for all four,
including the long-live Climax activation product — which reads as "not published to Online
Store" per its own field description. It's a false signal on this dev store (no working
storefront domain resolution for it, unrelated to publication). The reliable check is
`publishedOnPublication(publicationId: <Online Store channel's Publication id>)`, or
`resourcePublications` — both confirmed `true`/`isPublished: true` for all four. Don't trust
`onlineStoreUrl` alone on this store again.

**Prices are provisional.** €49,00 (Installatie aan huis) and €0,00 (Geen installatie) are
Thijs's working default, not confirmed by Odoo — he said these will be adjusted in Odoo at some
point. Flagged in `pricing.config.json` itself (`installationOptions.nami.note` and a new
`unresolved` entry `NAMI_INSTALL_PRICING_PROVISIONAL`), not just here.

## Design decisions worth knowing before touching this again

**Variant resolution follows the existing `activation` pattern exactly**: `all_products[handle]
.selected_or_first_available_variant.id`, resolved server-side, never a hardcoded variant id.
Same as `zv_activation_handle` already worked.

**The radio group is reload-based, not a live client-side patch.** On selection, JS does two
plain Cart AJAX calls (`/cart/update.js` to zero out every other fee-type variant — the 2 other
nami options AND a stray activation-fee line in one shot — then `/cart/add.js` for the chosen
one) and reloads the page on success. This mirrors `zv-cart-guard.liquid`'s own established
fix-then-reload pattern instead of introducing a new one. It was a deliberate choice over
computing "Vandaag te betalen" and the indicative contract value (ICV) purely in JS:
- "Vandaag te betalen" already sums every live cart line unconditionally (existing code) — a
  reload gets it right for free, zero new logic.
- The ICV needed a genuine server-side addition either way (see below), so doing the swap's
  follow-through server-side too, rather than splitting the same computation across Liquid and
  JS, avoids two implementations of the same formula drifting apart.
- Cost: the consent checkbox isn't preserved across the reload if the customer had already
  ticked it before picking an install option. Minor, and the same tradeoff already exists
  implicitly wherever `zv-cart-guard` reloads today — not a new class of issue.

**ICV recompute needed 2 new raw-cents values that didn't exist before**: `zv_activation_cents`
(global) and `zv_{pkg}_icv_cents` (per package), added to `build_pricing.py`'s emission
alongside the pre-formatted display strings it already produced (same pattern, just also
emitting the cents). Without these, the only way to adjust the ICV for a chosen nami option
would have been parsing the pre-formatted `zv_{pkg}_icv` string, which this codebase's own
`pricing.config.json` principle explicitly rules out ("no page may compute a price
independently").

**ICV formatting has one narrow, deliberate cosmetic inconsistency.** The page's other prices
(package monthly, activation, ICV) are pre-formatted Python strings with a space after `€`
("€ 49,00"). Checked the shop's actual `money_format` via Admin GraphQL
(`shop.currencyFormats.moneyFormat`) rather than assuming it matched: it's
`€{{amount_with_comma_separator}}` — **no space**. That's what Shopify's own `| money` filter
(already used for "Vandaag te betalen") produces. When the chosen nami option's price differs
from the flat activation fee (i.e. "geen" or "telefonisch", not "huis"), the recomputed ICV is
rendered via `| money` for correctness and thousands-separator safety, at the cost of a
barely-visible spacing difference vs. the rest of the page in that one case. Climax is
completely unaffected (its ICV always equals the untouched build-time string, byte for byte);
nami with nothing chosen yet or "huis" chosen also renders the original string unchanged, since
the amount happens to match. Building a Liquid-native thousands-separator formatter to close
this fully was considered and rejected as effort disproportionate to a cosmetic, narrow-case gap
— all 3 nami-eligible packages' ICVs stay comfortably under €1.000 even after the ±€49 swing, so
there's currently no case where this would even matter beyond the spacing.

**`pkg_install_group`** (`'nami'` / `'climax'`) is assigned per-branch inside the existing `case
fk` block, right alongside `pkg_meldkamer` — same hardcoded-per-branch style, defaults to
`'climax'` before the block so any unrecognized/future package (Vista, Veilig Onderweg) falls
through to today's fixed behaviour automatically.

## Two gaps found, deliberately not fixed here (out of the file list this task scoped)

**1. `sections/oplossingen.liquid` and `sections/vergelijk-pakketten.liquid` still add the flat
Climax activation fee unconditionally alongside *every* package add-to-cart, nami included.**
Verified by reading both files' add-to-cart JS before assuming otherwise — neither branches on
platform at all. Consequence: a nami package added via either page still arrives in cart with
`activatie-en-installatie` already in it. This doesn't break checkout safety (the Overzicht
gate still correctly blocks until a real nami choice is made — `cart_needs_activation` requires
one of the 3 nami variants specifically, ACT-INSTALL doesn't satisfy it for a nami cart), but it
does mean: if the customer never touches the radio group and somehow reaches checkout some other
way, or if they select a nami option, they'd be charged for ACT-INSTALL *and* an installation
choice unless something removes the stray ACT-INSTALL line. The Overzicht radio-swap JS handles
this defensively — it clears *every* known fee-type variant (activation included) before adding
the chosen one, so selecting any nami option correctly leaves exactly one fee line. But the
underlying add-to-cart flows still need fixing to not add ACT-INSTALL for nami packages in the
first place — same shape of fix as `pkg_install_group` here, applied to those two files'
activation-fee resolution. Not built now: neither file was in this task's scope, and the fix
touches two more files' worth of JS this brief didn't describe.

**2. `zv-cart-guard.liquid` can't reliably tell a nami subscription line from a climax one.**
The Cart AJAX API (`/cart.js`) doesn't expose `product.metafields` (`custom.finder_key`) the way
server-side Liquid does — confirmed by re-reading the existing guard's own comment before
assuming a fix, not by guessing. Its unchanged climax auto-add path (`hasSub && !hasActivation
→ add ACT-INSTALL`) is now additionally guarded by "skip if a nami-install variant is already
present," which handles the common case correctly, but a nami subscription reaching cart with
*genuinely no* fee line at all (rare given gap #1 above already adds one; realistically only via
the standalone Shopify product page, which wires in no fee either way) would still get the
Climax fee added by that unchanged branch. Both gaps share the same root cause and the same
shape of fix — worth doing together as follow-up, not guessed at here.

**3. (Minor, cosmetic, not a gap in logic) The "Onze monteur neemt na uw bestelling contact op
om de installatie in te plannen" line under the cost card is static and unconditional.** It
reads oddly next to "Geen installatie" or "Telefonische ondersteuning" (no monteur visit implied
by either). Left as-is — the right copy needs product/ops sign-off, same as this repo's existing
placeholder-copy items (see `vergelijk-pakketten.liquid`'s scenario-card mapping needing
Robi/Robert's sign-off, as one example of the established pattern for this kind of flag).

## Validation performed

- `python3 scripts/check_pricing.py` — all checks pass (caught one real mistake first: a
  Liquid *comment* I wrote for humans literally contained `'€49,00'`/`'€ 49,00'` as example
  text, which check #9's literal-price scanner correctly flagged since it scans raw file text
  including comments — reworded rather than suppressed).
- `shopify theme check --fail-level error` — 0 errors, 217 warnings (same pre-existing
  `UndefinedObject`/`UnusedAssign` class this repo's `ci.yml` already documents as expected for
  every `zv_*` variable coming through the dynamic `zv-pricing` include; none of the new
  variables introduced a new *kind* of warning).
- **Live click-through testing**, not just code reading: the public preview URL
  (`?preview_theme_id=`) is blocked by this store's storefront password, confirming the
  limitation `CLAUDE.md` already documents. Worked around it with `shopify theme dev --theme
  <id> --environment zoveiligdev`, which proxies through a CLI-authenticated local server
  (`http://127.0.0.1:9292`) that bypasses the password gate entirely — this is the same
  mechanism `CLAUDE.md`'s "Product data" section says was used to pull real product data before.
  Worth remembering for any future session blocked by the same password wall: push (or let
  `theme dev` push) to a disposable unpublished theme, then drive it via the local proxy with
  plain `curl` against `/cart/add.js`, `/cart/update.js` and `/cart.js` using a cookie jar for
  session state — no browser needed.
- Pushed the whole worktree to a disposable `zz-validate-nami-install-choice-2026-09-21`
  theme, drove real carts through it via the local proxy, and confirmed by reading the actual
  rendered HTML (not just the Liquid source):
  - Fresh nami cart (Inzicht, no fee line): radio group renders, all 3 unchecked, correct
    labels/prices/variant ids, checkout blocked (`data-needs-activation` present).
  - Selecting "Installatie aan huis" (€49, same as flat activation): swap succeeds, correct
    radio shows `checked` after reload, ICV unchanged (`€ 737,27`, original string, since the
    amount matches build-time default), checkout unblocked.
  - Switching to "Geen installatie" (€0): swap succeeds, ICV correctly recomputed to `€688,27`
    (`737,27 − 49,00 + 0,00`, via the `money` filter per the cosmetic note above), Vandaag te
    betalen correctly reflects the live cart.
  - Climax cart (Beschermd), no fee: static "Binnen 30 dagen, op afspraak" text, **no radio
    markup rendered at all** (verified by searching for the actual `<div class="ovinstall-
    options">` element, not just a substring match — an earlier naive check gave a false
    positive by matching the JS selector string, which is present on every page load
    regardless), checkout correctly blocked.
  - Climax cart + ACT-INSTALL added: ICV renders as the exact untouched build-time string
    (`€ 1.427,27`, with its original space), checkout correctly unblocked. Confirms zero
    observable change for Climax.
  - `/cart` (`zv-cart.liquid`) still renders cleanly with the new variant-id resolution wired
    through to `zv-cart-guard`.
  - One transient false alarm during testing: immediately after the very first full theme push,
    one single request showed a stale `cart_needs_activation` state that a repeat request (same
    cart, few seconds later) showed correctly resolved — theme-dev sync settling, not a code
    bug. Re-verified clean end-to-end on a fresh cart once settled; flagging here only so a
    future session doesn't waste time chasing the same ghost if a single request ever looks
    wrong immediately after a fresh push.
  - Disposable theme deleted after testing (`shopify theme delete --theme 189036527997`).

## Not done / explicitly out of scope

- Gaps #1 and #2 above (oplossingen.liquid / vergelijk-pakketten.liquid activation-fee wiring,
  and the cart-guard's metafield blind spot) — flagged, not fixed.
- Vista and Veilig Onderweg — not purchasable yet, `pkg_install_group` defaults correctly to
  `'climax'` for them by construction, but no real decision has been made for when they go live.
- The monteur-copy cosmetic note above.
