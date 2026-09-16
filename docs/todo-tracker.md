# Todo tracker

## Recently completed

### `feature/package-addons-uitbreidingen-2026-09-16` (research only, not yet merged)
- **Live Shopify verification of the 9 candidate package add-on products** (Nami PIR/
  Deursensor for Inzicht/Zeker/Alert; magneetcontact/PIR/afstandsbediening/rookmelder/camera
  730/camera 515/videodeurbel for Beschermd/Protect) — see
  `docs/package-addons-uitbreidingen-2026-09-16.md`. Checked against Shopify Admin
  (GraphQL) and the storefront JSON proxy, not guessed or reused from
  `camera-hardware.liquid`'s unverified static numbers.

## Open items

### Package add-ons ("Uitbreidingen" checkboxes on Oplossingen) — new today, blocked
- [ ] **Nami PIR / Nami Deursensor don't exist as standalone Shopify products** (only two
  €0,00 package-placeholder products exist under the Nami vendor, tied to the aiAware/Alarm15
  package bundles, not sellable sensors). Needs a decision: ship Inzicht/Zeker/Alert with no
  add-on checkboxes for now, or create the real products first.
- [ ] **Videodeurbel candidate is ambiguous.** Real Shopify products exist for 750 (plain,
  €299), 780+chime (€425, and confusingly as *two* separate duplicate active products with
  the same title), and 770+chime (€425, a model not seen anywhere else in this repo) — none
  is a clean match for "VIDEO DEURBEL MET ANALYTICS (VDB 750) + CHIME WIFI VERSTERKER". Needs
  Thijs to pick one (and probably archive the 780 duplicate in Shopify while at it).
- [ ] **Magneetcontact/PIR/afstandsbediening/rookmelder (CL001/CL002/CL004/CL005) have no
  monthly price anywhere** — confirmed one-off-only in Shopify (single variant, no recurring
  variant). Needs a decision: show the one-off € price on the checkbox, or set a monthly rate
  first.
- [ ] **Blocking regardless of the above three: none of the confirmed candidate products are
  published to the Online Store sales channel** (`ACTIVE` in admin, but 404 on the storefront
  JSON proxy) — `{{ all_products[handle] }}` resolves to `nil` for all of them right now. Needs
  publishing in Shopify admin before any Liquid price lookup will work.
- [ ] Step 2 (editing `sections/oplossingen.liquid`'s "Uitbreidingen toevoegen" list) has not
  started — nothing to wire in without a decision on the four items above. Step 3 (validation)
  and the push to `origin` are correspondingly not done either.

## Daily update log

### 2026-09-16
Ran the live-verification step for the planned per-package "Uitbreidingen" checkboxes on
Oplossingen (real add-ons with real Shopify prices instead of "Prijs volgt"), on
`feature/package-addons-uitbreidingen-2026-09-16`. Findings written to
`docs/package-addons-uitbreidingen-2026-09-16.md`. Result: 2 of 9 items don't exist as
standalone products (Nami PIR/Deursensor), 1 is genuinely ambiguous between three real
products plus a duplicate (videodeurbel), 4 have no monthly price anywhere (koop-only), and —
the item blocking all of them regardless — none of the confirmed real products are published
to the Online Store channel, so a live price lookup would return nothing today even for the
unambiguous ones (Camera 730, Camera 515 binnen). No Liquid was changed; Step 2 is on hold
pending Thijs's answers to the four open questions above.
