# Mijn Thuis: equal-height spacer fix + Meldkamer/Camera relocation (2026-09-15)

Branch: `fix/mijn-thuis-card-height-badges-2026-09-15`, based on `origin/main` (which
already includes `fix/mijn-thuis-vista-images-card-height-2026-09-15` via PR #34 — that
branch was merged by the time this session started, so this branch is off `main`
directly rather than the now-stale branch ref).

## Step 1 — align-items:start replaced with equal-height + bottom spacer

The prior fix (`align-items: start`) removed the dead-space gap but left the three Mijn
Thuis cards at visibly different natural heights (Alert 510px, Protect 569px, Vista
452px desktop), which reads as broken, not intentional.

Reverted to the grid's default `align-items: stretch` (all three cards equal-height
again, matching Protect — the naturally tallest). `.ltc__cta`/`.pcard__foot`'s shared
`margin-top: auto` (used to pin content to the card bottom under stretch) is overridden
back to a normal margin, but **only inside `.pgrid[data-anchor="mijn-thuis"]`** — the
base rule is untouched, so Langer Thuis's already-approved equal-height row (PR #19) and
Veilig Onderweg's tile cards (which also use `.pcard__foot`) keep their original
behavior. In its place, a new trailing element (`.ltc__spacer`, `flex: 1 1 auto`) is
rendered as the very last child of each Mijn Thuis card (after "Meer informatie" for
Alert/Protect, after the lead form for Vista) — gated by `{%- if anchor == 'mijn-thuis' -%}`
in the Liquid template — so any leftover stretch height collapses there instead of
between the badges and the CTA.

**Gotcha hit and fixed**: Dawn's `assets/base.css` has a global
`div:empty { display: none; }` reset. Since `.ltc__spacer` is intentionally childless,
that reset hid it outright regardless of `flex: 1 1 auto` (a single-class selector
`.ltc__spacer` has lower specificity than the reset's `div:empty`). Fixed with a
2-class selector (`.pcard .ltc__spacer`), the same pattern already used elsewhere in
this file for `.addcart__scrim` against the identical reset.

Verified via `getComputedStyle`/`offsetHeight` (not just eyeballing) before and after:
desktop, all three cards now report `569px`, with the spacer absorbing exactly the
natural-height deficit (Alert's spacer: 59px, Vista's: 118px, Protect's: 0px, since it's
already the tallest). Mobile (single column, no row-sharing) is unaffected — spacers
report 0px there since there's no stretch to absorb. Langer Thuis confirmed unchanged:
still `align-items: normal`, all three cards still 465px.

## Step 2 — MELDKAMER/CAMERA banner removed from the front of the card

Checked first (before deleting anything) whether this info already existed elsewhere:
neither the "Wat zit erin?" panel (`ltc_hw_bullets`, raw hardware component names only)
nor "Uitbreidingen" (generic add-on configuration, unrelated) mentioned Meldkamer/Camera
status anywhere. **Not duplicated anywhere else on the card.**

So per the fallback instruction: removed the `.ltc__badges` pill-banner markup and its
now-fully-unused CSS (`.ltc__badges`, `.ltc__badge-col`, `.ltc__badge-lbl`, `.ltc__badge`,
`.ltc__badge--ja/nee/optioneel`), and added it as two plain `<li>` lines inside the
existing `.ltc__hw` list in "Wat zit erin?" — same markup/typography as the hardware
bullets already there, no new visual treatment: "Meldkamer: Nee" / "Camera: Nee" for
Alert, "Meldkamer: Ja" / "Camera: Optioneel" for Protect. `ltc_meldkamer`/`ltc_camera`
stay blank for Langer Thuis, so neither the old banner nor these new lines ever
rendered there — confirmed via Playwright, not assumed.

## Validation

- `python3 scripts/check_pricing.py` — all checks pass.
- `shopify theme check` — 0 errors, 161 warnings, identical to the `origin/main`
  baseline (established in the prior branch's session) — no new warnings.
- Verified locally via `shopify theme dev`'s local proxy (bypasses the storefront
  password wall): equal card heights confirmed by measurement, no MELDKAMER/CAMERA
  banner on Alert/Protect's front (0 elements matched, desktop and mobile), Meldkamer/
  Camera text confirmed present inside "Wat zit erin?" when expanded, Langer Thuis
  confirmed pixel-identical to before (465px × 3, `align-items: normal`).
- Also pushed to disposable unpublished theme `zv-mijn-thuis-card-polish-2026-09-15`
  (`#188865806717`) for a manual look if wanted — **delete once confirmed.**
