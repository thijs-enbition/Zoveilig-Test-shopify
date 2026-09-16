# Package add-ons ("Uitbreidingen") — live product verification (2026-09-16)

**Research only. No Liquid was changed by this document.** Per the task brief, Step 2 (editing
`sections/oplossingen.liquid`) only proceeds for items confirmed here — and per the STOP
conditions in the brief, several items below are not confirmed, so this doc ends in an open
question back to Thijs rather than a code change.

**Method:** live Shopify Admin GraphQL (`search_products` against `zoveiligdev.myshopify.com`,
confirmed via `get-shop-info`) for handle/price/SKU ground truth, cross-checked against the
storefront JSON proxy (`shopify theme dev`'s already-running local proxy on `127.0.0.1:9292`,
same store) for what a real `{{ all_products[handle] }}` Liquid lookup would actually resolve
to on this theme. The two disagree in an important way — see **Blocking finding** below.

## Blocking finding: none of these candidate products are published to the Online Store

Every product below exists in Shopify Admin with `status: ACTIVE`, a real handle, and a real
price. But every single one 404s on the storefront JSON endpoint
(`/products/<handle>.json`) — confirmed individually for all 12 handles found. Compare: the 9
products the storefront *does* serve (the 6 packages, 2 Veilig Onderweg placeholders,
Activatie en installatie) all resolve fine on the same proxy.

**Practical consequence: `{{ all_products[handle] }}` for any of these add-on products
resolves to `nil` in Liquid right now**, regardless of which handle is used — not a code bug,
a storefront-channel publication gap in Shopify admin (Sales channels → Online Store). Writing
`{{ all_products[handle].price | money }}` today would silently render blank/zero for every
add-on checkbox. This needs to be fixed in Shopify admin (publish each product to the Online
Store channel) before Step 2's Liquid can show a real price — it is not something `check_pricing.py`,
`shopify theme check`, or a disposable-theme push would catch, since all three validate the
theme, not the catalog's channel publication.

## Group A — Nami PIR / Nami Deursensor (aware / aware_plus / secure)

| Item | Searched for | Found | Confidence |
|---|---|---|---|
| "Nami PIR" (spec-sheet ZV-P001, `pir` in opl-modal-data) | standalone Nami PIR product | **not found** | n/a |
| "Nami Deursensor" (spec-sheet ZV-P004) | standalone Nami deursensor product | **not found** | n/a |

The only two Nami-branded products in the store are:
- `nami-langer-thuis-inzicht` — title "Nami Langer Thuis Inzicht", SKU `AWARE10 Type F`, price €0,00
- `nami-mijn-thuis-alert` — title also "Nami Langer Thuis Inzicht" (looks like a data-entry
  mistake in Shopify — handle/SKU point at Mijn Thuis Alert instead), SKU `ALARM15 Type F`,
  price €0,00

Both are €0,00, zero-inventory placeholder products tied to the *package* SKUs
(`AWARE10`/`ALARM15` match the NAMI aiAware/Alarm15 hardware bundles already described in
`ltc_hw_bullets` for `aware`/`secure`), not standalone sellable sensors. There is no Shopify
product — published or unpublished — for a standalone Nami PIR or Nami deursensor add-on.

**→ This is exactly the brief's stop condition: "the two Nami items ... turn out not to exist
as standalone purchasable products at all." Nothing was added to code for Inzicht/Zeker/Alert
(aware/aware_plus/secure) — see Open questions below.**

## Group B — Beschermd (care) / Protect (guard)

| SKU | Item | Shopify handle | Price | Recurring? | Confidence |
|---|---|---|---|---|---|
| CL001 | Magneetcontact (DC-23) | `koop-magneetcontact-dc-23` | €60,00 | **one-off only** — single "Default Title" variant, no monthly variant anywhere in Shopify | high (unique match, price matches `camera-hardware.liquid`'s local `koop:60.00`) |
| CL002 | PIR Bewegingsdetector | `koop-pir-bewegingsdetector` | €60,00 | **one-off only** | high |
| CL004 | Afstandsbediening | `koop-afstandsbediening` | €40,00 | **one-off only** | high |
| CL005 | Rookmelder | `koop-rookmelder` | €60,00 | **one-off only** | high |
| CAM-730 | Buitencamera wifi 730 | `koop-730-buitencamera-wifi` | €325,00 | one-off (koop); no separate monthly huur variant on this product itself — `camera-hardware.liquid`'s `huur: 28.44` is a locally-coded rental rate, not a Shopify variant | high — handle matches the doc's candidate exactly, price matches |
| CAM-BINNEN | Binnencamera met SD kaart ("515 binnen") | `koop-515-binnencamera` | €175,00 | one-off; same caveat as CAM-730 (local `huur:15.31` isn't a Shopify variant) | high — title is "(Koop) 515 binnencamera ***" (note trailing `***`, flagged as placeholder-looking in the 2026-09-11 doc), price matches CAM-BINNEN's `koop:175.00` exactly |
| VDB-750 (per brief: "VIDEO DEURBEL MET ANALYTICS (VDB 750) + CHIME WIFI VERSTERKER") | Videodeurbel | **ambiguous — see below** | — | — | **not resolved** |

All four "koop only" items (CL001/CL002/CL004/CL005) confirmed via Admin: exactly one variant
each (`Default Title`), one price, no recurring/monthly figure anywhere in Shopify. This
matches the brief's "koop only, no huur" framing exactly — see Open questions.

### Videodeurbel: real candidates, none is a clean match

The brief's phrase names three things at once: model "VDB 750", "analytics", and a chime that
is also a "wifi versterker" (repeater). Shopify has multiple real, distinct products in this
family, none matching all three:

| Handle | Title | SKU | Price | Chime? |
|---|---|---|---|---|
| `koop-video-deurbel-750` | (Koop) Video Deurbel 750 *** | `ADC-750` | €299,00 | not mentioned in title; this is the plain 750, no "+ chime" |
| `koop-video-deurbel-draadloos-780-chime-wifi` | (Koop) Video Deurbel Draadloos 780 + Chime (WiFi) | `ADC-VDB780-SG` | €425,00 | yes, "780 + Chime" |
| `koop-video-deurbel-draadloos-780-chime-wifi-1` | (Koop) Video Deurbel Draadloos 780 + Chime (WiFi) | `ADC-780` | €425,00 | yes — **duplicate of the row above**, same title/price, different handle+SKU |
| `koop-video-deurbel-bedraad-770-chime-wifi` | (Koop) Video Deurbel Bedraad 770 + Chime (WiFi) | `ADC-VDB770-SG` | €425,00 | yes, "770 + Chime" — a model not previously seen anywhere in this repo |
| `koop-buitencamera-adc-vdb755p` | (Koop) Buitencamera ADC-VDB755P | `ADC-VDB755P` | €350,00 | n/a — this is titled as a *buitencamera*, not a deurbel, despite the "755" in the SKU echoing `camera-hardware.liquid`'s local "VDB 755 + chime" row |

Per `camera-hardware.liquid`'s own specs (already in-repo, lines 106-123): the "chime that also
acts as a 2.4GHz wifi-versterker" description is specifically the ADC-W115C chime bundled with
**780** ("inbegrepen ... fungeert ook als wifi-versterker"), not 750 (750's chime spec says only
"compatibel", not bundled, and says nothing about a wifi-versterker function). So the brief's
"wifi versterker" detail points at 780, while the brief's explicit "(VDB 750)" points at 750 —
these are two different real products, and the "analytics" framing doesn't disambiguate either
way (Alarm.com markets video analytics/person-detection across several of its doorbell models,
not exclusively one). There's also an unresolved duplicate (780 has two separate active Shopify
products with the same title) and a previously-unseen 770 model.

**→ This is the brief's stop condition: "more than one plausible candidate exists and you can't
tell which." No handle chosen — see Open questions.**

## Open questions for Thijs (nothing coded until these are answered)

1. **Nami PIR / Nami Deursensor don't exist as standalone products.** Should aware/aware_plus/
   secure get no "Uitbreidingen toevoegen" checkboxes at all for now (leave that optgroup empty
   for those three tiers), or do these need to be created as real Shopify products first?
2. **CL001/CL002/CL004/CL005 (magneetcontact, PIR, afstandsbediening, rookmelder) have no
   monthly price anywhere** — only a one-off koop price. Show the one-off €-price on the
   add-on checkbox instead of a "/mnd" figure, or does a monthly rate need to be set first
   (e.g. in Shopify, or via a new field in `pricing.config.json`)?
3. **Videodeurbel is ambiguous** (750 plain €299 vs. 780+chime €425 [×2 duplicate products] vs.
   770+chime €425 vs. the 755P buitencamera at €350) — which one is "VIDEO DEURBEL MET
   ANALYTICS (VDB 750) + CHIME WIFI VERSTERKER"? If it's 780, which of the two duplicate 780
   products (`koop-video-deurbel-draadloos-780-chime-wifi` vs. `...-1`) is the one to keep live
   — the other looks like it should probably be archived in Shopify, but that's a store-data
   call, not something to guess at here.
4. **None of the confirmed Group B handles are published to the Online Store channel** (all
   404 on the storefront JSON proxy despite being `ACTIVE` in admin) — this blocks a live
   `{{ all_products[handle].price }}` lookup regardless of the answers to 1-3. These need
   publishing to the Online Store sales channel in Shopify admin first.

Given 1-4 are all open, **Step 2 has not been started** — there is currently no confirmed item
to wire into `sections/oplossingen.liquid` for either package line without guessing on at least
one of the above.

## Status (2026-09-16, after Thijs's answers)

Thijs answered questions 1-3 directly: Inzicht/Zeker/Alert ship with no add-on checkboxes for
now (question 1); the one-off € price is shown as-is on the four Climax items, no monthly
figure needed (question 2); the videodeurbel is the plain 750
(`koop-video-deurbel-750`, €299,00), not 780 or 770 (question 3). On question 4 — none of the
confirmed products being published to the Online Store channel — Thijs said he'll publish them
in Shopify admin himself; nothing else to do on the code side once that's done, since
`all_products[handle]` already resolves live with no redeploy needed.

`sections/oplossingen.liquid`'s "Uitbreidingen toevoegen" list for Beschermd/Protect (care/
guard) now shows the 7 confirmed Group B items above, each priced live via
`all_products[handle].price`, replacing the old shared `b.settings.uitbreidingen` textarea with
a per-package `case`/`when` list ("Prijs volgt" only as a fallback if a handle can't resolve).
Inzicht/Zeker/Alert (aware/aware_plus/secure) render no add-ons optgroup at all, per question
1's answer — not guessed, not left as a stray empty "Uitbreidingen toevoegen" heading.

Validated: `python3 scripts/check_pricing.py` (all pass), `shopify theme check` (0 errors; the
one new warning nudged, LiquidComplexity 122→126, is the same pre-existing over-120 warning
`origin/main` already carries, not a new offense caused by this change), and a push to a
disposable unpublished theme (`zz-validate-package-addons-20260916165236`, deleted immediately
after). Pushed to `origin/feature/package-addons-uitbreidingen-2026-09-16` — never
`veronica-origin`. No PR opened; Thijs opens that manually.

### Open items

- **Blocking, Shopify-admin-side, not code**: none of the 7 confirmed care/guard add-on
  products are published to the Online Store sales channel (`ACTIVE` in admin, but 404 on the
  storefront JSON proxy as of 2026-09-16) — every checkbox shows "Prijs volgt" until this is
  fixed. Thijs is publishing them himself; the Liquid needs no further change once that
  happens.
- The duplicate "780 + Chime (WiFi)" product in Shopify
  (`koop-video-deurbel-draadloos-780-chime-wifi` and `...-1`, same title/price, different
  handle+SKU) is unrelated to what shipped (plain 750 was chosen instead) but is still sitting
  in the store as a data-quality issue worth cleaning up separately.
- PR not yet opened — Thijs opens it manually per his own instruction.
