# Mijn Thuis Alert/Protect: "Wat zit erin?" panel + benefit-led copy (2026-09-14)

Branch: `fix/mijn-thuis-card-wat-zit-erin-2026-09-14`, based on `origin/main` (which already
includes PR #31 / `feature/mijn-thuis-card-redesign` — see below).

## What this branch does

1. **Reverts the Vista header restyle merged via PR #31** (commit `f517549`, "Vista:
   visual-only header restyle to match the card-grid family"). That PR already migrated
   Alert/Protect onto the `pcard--ltc` card-grid and gave Vista new `.ltc__head` header
   chrome, but Vista's product list/copy still hasn't been reviewed — this branch's brief
   requires leaving Vista completely untouched until that happens, so the restyle is
   reverted here (clean `git revert`, no conflicts) rather than carried forward.
2. **Moves Alert/Protect's raw hardware checklist into the "Wat zit erin?" panel**
   (`ltc_hw_bullets`), matching how Inzicht/Zeker/Beschermd already populate that same
   panel — instead of showing the raw part list on the front of the card.
3. **Replaces the front-of-card tagline/checklist with benefit-led copy** for Alert and
   Protect. Meldkamer/Camera badges and looptijd are unchanged in position/behavior.
4. **Fixes a pre-existing bug**: `ltc_hw_bullet_list` (looped over in the "Wat zit erin?"
   panel) was never assigned from `ltc_hw_bullets` anywhere in the file, so that panel
   silently rendered empty for every package — including the already-shipped Langer Thuis
   cards — before this branch. Also initializes `ltc_hw_bullets` per iteration (it wasn't
   reset to blank, so a package that doesn't set it could inherit the previous package's
   hardware list within the same `for` loop).

## Vista — explicitly out of scope, needs follow-up

Vista's card is back to its pre-PR#31 state (photo tile, no header restyle) and its
product list/front-of-card copy has **not** been reviewed or drafted. The same benefit-led
"Wat zit erin?" treatment given to Alert/Protect here should be applied to Vista once:

- Its product list is confirmed (see `docs/mijn-thuis-card-redesign-research-2026-09-14.md`
  §4 for the architectural constraints — Vista must stay on its own lead-form branch, not
  the shared `ltc` component's checklist/badge/price data model).
- Benefit-led headline/bullets are drafted and signed off, same as Alert/Protect got here.

## Validation

- `python3 scripts/check_pricing.py` — all checks pass.
- `shopify theme check` — 0 errors; `sections/oplossingen.liquid` has zero offenses (the
  160 pre-existing warnings elsewhere in the theme are unrelated to this change).
- Pushed to disposable unpublished theme `zv-mijn-thuis-wat-zit-erin-2026-09-14`
  (`#188864921981`) for manual click-through (collapsed/expanded panel, mobile+desktop) —
  the store's storefront password wall blocked automated (Playwright) verification, so
  Thijs is checking this manually. **Delete the disposable theme once that's confirmed.**
