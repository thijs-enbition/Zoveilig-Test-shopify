# Todo tracker

## Recently completed

### `feature/package-addons-uitbreidingen-2026-09-16` (pushed to `origin`, no PR opened yet)
- **Live Shopify verification of the 9 candidate package add-on products** (Nami PIR/
  Deursensor for Inzicht/Zeker/Alert; magneetcontact/PIR/afstandsbediening/rookmelder/camera
  730/camera 515/videodeurbel for Beschermd/Protect) — see
  `docs/package-addons-uitbreidingen-2026-09-16.md`. Checked against Shopify Admin
  (GraphQL) and the storefront JSON proxy, not guessed or reused from
  `camera-hardware.liquid`'s unverified static numbers.
- **Beschermd/Protect (care/guard) "Uitbreidingen toevoegen" now shows 7 real, priced
  add-ons** (Magneetcontact DC-23, PIR Bewegingsdetector, Afstandsbediening, Rookmelder,
  Buitencamera wifi 730, Binnencamera met SD kaart, Videodeurbel 750), each price pulled live
  via `all_products[handle].price` — no hardcoded amount, "Prijs volgt" only as a fallback if
  a handle can't resolve. Replaces the old single shared `b.settings.uitbreidingen` textarea
  with a per-package `case`/`when` list (`sections/oplossingen.liquid`), following Thijs's
  decisions: one-off € price shown as-is (no monthly figure exists for these four Climax
  items), plain "750" chosen for the videodeurbel over the 780/770 candidates.
- **Inzicht/Zeker/Alert (aware/aware_plus/secure) intentionally ship with no add-on
  checkboxes** — confirmed with Thijs: Nami PIR/Deursensor don't exist as standalone Shopify
  products (only two zero-price package-placeholder products under the Nami vendor), so the
  optgroup is hidden for those three tiers rather than guessed.
- Validated: `python3 scripts/check_pricing.py` (all pass), `shopify theme check` (0 errors;
  the one new warning nudged, LiquidComplexity 122→126, is the same pre-existing over-120
  warning `origin/main` already carries, not a new offense), and a push to a disposable
  unpublished theme (`zz-validate-package-addons-20260916165236`, deleted after). Pushed to
  `origin/feature/package-addons-uitbreidingen-2026-09-16` — **not** `veronica-origin**. No PR
  opened (Thijs does that manually).

## Open items

### Package add-ons — blocked on a Shopify admin action, not code
- [ ] **None of the 7 confirmed care/guard add-on products are published to the Online Store
  sales channel** (`ACTIVE` in admin, but 404 on the storefront JSON proxy as of 2026-09-16) —
  `all_products[handle]` resolves to `nil` for all of them right now, so every checkbox will
  show "Prijs volgt" until this is fixed. Thijs said he'll publish them in Shopify admin
  (Sales channels → Online Store) himself; nothing else to do here once that's done — the
  Liquid already resolves live once the products are published, no redeploy needed.
- [ ] The duplicate "780 + Chime (WiFi)" product in Shopify (`koop-video-deurbel-draadloos-
  780-chime-wifi` and `...-1`, same title/price, different handle+SKU) is unrelated to what
  shipped (plain 750 was chosen instead) but is still sitting in the store as a data-quality
  issue worth cleaning up separately.
- [ ] PR not yet opened — Thijs opens it manually per his own instruction.

## Daily update log

### 2026-09-16
Shipped per-package "Uitbreidingen" add-on checkboxes for Beschermd/Protect on Oplossingen,
after a live Shopify verification pass surfaced four blockers (documented in
`docs/package-addons-uitbreidingen-2026-09-16.md` and put to Thijs directly): Nami PIR/
Deursensor don't exist as standalone products (→ Inzicht/Zeker/Alert ship with no add-on
checkboxes), the videodeurbel candidate was ambiguous between three real products plus a
duplicate (→ Thijs picked plain 750), the four Climax items have no monthly price anywhere
(→ shown as one-off), and none of the confirmed products are published to the Online Store
channel yet (→ Thijs will publish them himself; the code already resolves live once that
happens). Validated via `check_pricing.py`, `theme check`, and a disposable-theme push/delete,
then pushed to `origin/feature/package-addons-uitbreidingen-2026-09-16` (never
`veronica-origin`). No PR opened yet.
