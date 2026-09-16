# Camera-hardware page — product additions (2026-09-11)

**Why this exists:** on `feature/camera-hardware-add-products`, 12 hardware products were
added to `sections/camera-hardware.liquid`'s hardcoded `HW` configurator array. Several
decisions were made mid-session (in chat, not in the original task spec) and several data
points were sourced from a CSV export rather than re-verified live. None of that is written
down anywhere else in the repo — a future session reading only the code would not know *why*
these choices were made, so it could silently re-litigate or "fix" them. This file is the
record; it does not change any code.

## Open items

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Rent ("huur") "coming soon" UX | **Needs confirmation** | [`sections/camera-hardware.liquid:117`](../sections/camera-hardware.liquid#L117) |
| 2 | SKU 730 / ADC-750 / ADC-780 excluded as duplicates | **Needs confirmation** | [`sections/camera-hardware.liquid:77,82,84`](../sections/camera-hardware.liquid#L77) |
| 3 | New `sku`/`huurSku` values not re-verified live | **Known gap, spot-check recommended** | [`sections/camera-hardware.liquid:85-96`](../sections/camera-hardware.liquid#L85-L96) |
| 4 | "(Koop) Binnencamera 516 ***" — no matching product | **Blocked, not added** | n/a — deliberately absent from `HW` |
| 5 | Placeholder-looking titles | **Left as-is on purpose** | [`sections/camera-hardware.liquid:86,90`](../sections/camera-hardware.liquid#L86) etc. |

### 1. Rent "coming soon" UX

All 12 newly added `HW` entries carry `huur:null` (see lines 85–96) because the task's product
list gave only a one-off buy price, no monthly rental figure. `modeChip()`
([`camera-hardware.liquid:115-123`](../sections/camera-hardware.liquid#L115-L123)) was extended so
that when `huur` is `null` it renders a disabled chip — "Huren · Binnenkort beschikbaar" — instead
of computing `€ NaN`. `renderSummary()`'s phone-order payload and the "Gekozen" SKU line both
already had a fallback (`huurSku||sku`) added for when a rental price does land, in case the
rental variant turns out to be a distinct Shopify product from the buy one rather than the same
product at a monthly rate.

This exact approach ("buy connected now, rent coming soon, code it so rent could be a different
product later") was given as a follow-up instruction in chat mid-session — it was not in the
original task brief. **It has not been confirmed as the intended direction beyond that one chat
message.** Before this ships, confirm:
- The "Binnenkort beschikbaar" copy and disabled-chip treatment is the wanted UX (vs., e.g.,
  hiding the Huren chip entirely for buy-only rows).
- The `huurSku` field name/shape is a sensible place to hang a future distinct rental product
  reference, since nothing consumes it yet.

### 2. SKU 730 / ADC-750 / ADC-780 excluded as duplicates

Three of the original 15 requested products were **not** added, on the judgment that they're the
same physical product as three rows already present in `HW`:

| Requested (not added) | Existing row treated as the same product | Match basis |
|---|---|---|
| SKU 730, handle `koop-730-buitencamera-wifi`, €325,00 | `Buitencamera wifi 730` — `sku: CAM-730`, koop €325,00 ([line 77](../sections/camera-hardware.liquid#L77)) | Price + model number "730" |
| ADC-750, handle `koop-video-deurbel-750`, €299,00 | `Video deurbel bedraad VDB 750` — `sku: VDB-750`, koop €299,00 ([line 82](../sections/camera-hardware.liquid#L82)) | Price + model number "750" |
| ADC-780, handle `koop-video-deurbel-draadloos-780-chime-wifi-1`, €425,00 | `Video deurbel draadloos VDB780B + chime` — `sku: VDB-780`, koop €425,00 ([line 84](../sections/camera-hardware.liquid#L84)) | Price + near-identical "780 draadloos + chime" description |

**The match was made on price and model number, not on SKU or title** — none of the three pairs
share a SKU code or an exact title string with their existing counterpart. This is a reasonable
inference (identical price + identical model number for a physical security camera/doorbell is a
strong signal) but it is an inference, not a confirmed 1:1 SKU mapping from Shopify admin. If it
turns out these are actually distinct products (e.g. a supplier refresh under a new SKU at the
same price point), all three were dropped from the page in error and need to be added back.

### 3. New product data not re-verified live

The 12 added rows' prices, titles, and SKUs came from the task's product table, itself sourced
from `products_export_1.csv` (not committed to this repo — external to it). Per this repo's usual
practice ([`CLAUDE.md`](../CLAUDE.md)'s **Product data** section), that kind of claim should be
re-confirmed live via `shopify theme console` or the local `/products.json` proxy before being
trusted as current. That re-confirmation **did not happen** this session:
- `shopify theme console` is an interactive TTY-only REPL; piped/non-interactive input did not
  work in this session (`readline was closed` / the process hung waiting on stdin).
- The storefront (`https://zoveiligdev.myshopify.com/products/*.json`) returned `401` —
  password-protected, and no store password was available to this session.

The file itself **was** validated against Shopify's real Liquid validator (`shopify theme push
--unpublished` to a disposable theme, then deleted) — that only confirms the Liquid syntax is
accepted, not that the product data inside it is current. Recommend a spot-check of the 12
handles/SKUs/prices in Shopify admin before merging.

### 4. "(Koop) Binnencamera 516 ***" — still not addable

Confirmed (as stated in the original task) that no Shopify product exists for this internal list
entry — no handle, no SKU, no price. Left out of `HW` entirely; needs a real product created in
Shopify (with SKU, price, and — per the task's own image-gap note — ideally an image) before it
can be added here.

### 5. Placeholder-looking titles

Two titles were carried into `HW` verbatim, unedited, because they read as internal/placeholder
text rather than customer-facing Dutch copy:
- `4MP_WIFI_MICKEY_MOUSE` (SKU ADC-MM, [line 86](../sections/camera-hardware.liquid#L86))
- Trailing `***` on titles sourced from products with that suffix in Shopify (none of the
  three-star items ended up in this batch of 12, since ADC-750 was excluded as a duplicate — see
  item 2 — but the pattern should be watched for on any future addition from the same product
  set, e.g. if item 2's exclusion is reversed)

These were deliberately not rewritten. Needs real, confirmed Dutch copy (u-vorm, no internal
naming) before this ships to customers.

---
*Written 2026-09-11 on `feature/camera-hardware-add-products`, following up on the product
additions in that branch's own commit. No code was changed by this document.*
