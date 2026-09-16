# Mijn Thuis: Vista photo removal + card-height whitespace fix (2026-09-15)

Branch: `fix/mijn-thuis-vista-images-card-height-2026-09-15`, based on `origin/main`
(which already includes `fix/mijn-thuis-card-wat-zit-erin-2026-09-14` via PR #33).

## Vista's photo block (Step 1 investigation)

Vista (`secure_plus`) renders through the old `pcard--tile` branch, not the shared
`pcard--ltc` component. Its "product photos" were a single designed JPG
(`assets/opl-tile-06.jpg`, `.pcard__tileimg`) that baked together the Alarm Hub/
Binnencamera/Buitencamera/Videodeurbel photos, the "IN HET PAKKET" pill list, and the
Meldkamer/Camera Ja/Ja badges as one graphic — confirmed by reading the markup (only one
`<img>`, no sibling text/badge elements) and consistent with
`docs/mijn-thuis-card-redesign-research-2026-09-14.md`. There was no separate live text
list or badge markup to preserve when removing the image. Per direction, the image was
removed with no replacement copy — Vista's front card is now sub-line + "Geen vast
pakket" + lead form only, until its product list/copy is drafted and signed off (same
open item noted in the prior branch's docs).

## Whitespace gap (Step 1 investigation, Step 3 fix)

The reported gap (empty space between the MELDKAMER/CAMERA badges and "In winkelwagen"
on Alert/Protect) was **not** solely a Vista side-effect, though Vista's original tall
image was a contributing factor before this branch:

- `.pgrid` is a CSS Grid with no `align-items` set (defaults to `stretch`), forcing every
  `.pcard` in a row to the row's tallest sibling. `.ltc__cta{margin-top:auto}` then
  absorbs the extra height as visible empty space above the CTA.
- Removing Vista's image (first commit) shrank the row's height but did **not** remove
  the gap. Measured via `getComputedStyle`/forced-`height:auto` comparison before writing
  any CSS: at desktop width, Protect (`guard`) is itself the naturally tallest of the
  three cards (569px vs Alert's 510px and Vista's 452px) — Alert was being stretched to
  match **Protect**, not Vista. No leftover `min-height` or stray spacer exists anywhere
  in the file.
- Fix: `.pgrid[data-anchor="mijn-thuis"] { align-items: start; }`, scoped via a new
  `data-anchor` attribute on `.pgrid` so Langer Thuis's already-approved equal-height row
  (PR #19, confirmed still `align-items: normal`/stretch, all three cards still 465px)
  is untouched.

## Validation

- `python3 scripts/check_pricing.py` — all checks pass.
- `shopify theme check` — 0 errors, 161 warnings, identical count to `origin/main`
  baseline (verified via a throwaway worktree) — no new warnings introduced.
- Verified locally via `shopify theme dev`'s local proxy (bypasses the storefront
  password wall that blocked automated checks on the prior branch):
  - Desktop (1440px): each Mijn Thuis card now sizes to its own natural height (Alert
    510px, Protect 569px, Vista 452px) instead of all being stretched to 569px; no dead
    space above any CTA. Langer Thuis's grid unaffected (still stretched, 465px/465px/465px).
  - Mobile (390px, single column): unaffected — was already natural height there (grid
    stretch only applies within a shared row).
  - Vista's lead form: submitted with the network request intercepted (never sent to the
    real Odoo webhook) — correct endpoint
    (`zoveilig-2026-06-15-....dev.odoo.com/web/hook/...`), correct payload shape
    (`lead_type":"vista"`, name/phone/consent/item fields), success state renders.
- Also pushed to disposable unpublished theme `zv-mijn-thuis-vista-height-2026-09-15`
  (`#188865413501`) for a manual look if wanted — **delete once confirmed.**
