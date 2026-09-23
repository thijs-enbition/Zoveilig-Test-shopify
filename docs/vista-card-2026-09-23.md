# Vista card (spec §10), 2026-09-23

Branch `feature/vista-card-2026-09-23`. Spec: `docs/pakket-wijzigingen-2026-09-23.md` §10 plus
its Addendum line. Only `sections/oplossingen.liquid` changes.

## What the card is now

Vista still renders through the **tile branch** (`pcard--tile`, now also `pcard--vista`), not the
shared `pcard--ltc` card: `use_ltc` stays false for `secure_plus`. The branch borrows the ltc
header and checklist markup:

1. `ltc__head`: a new icon (camera viewfinder around an eye, 64x64, `--indigo` strokes, one
   `--red` pupil), the name "Vista" (`short_name`, from `pricing.config.json`) and the tagline.
2. `ltc__checklist`: 7 bullets, printed as escaped plain text (no link markers).
3. The lead form. Under the fields the order is: the consent checkbox (new wording, kept for
   AVG), the advice text (`.pcard__vista-note`, copied byte for byte from the spec, en dash
   included), then the "Plan een vrijblijvend adviesgesprek" button.

The copy lives in the `when 'secure_plus'` branch of the **second** ltc case block. The ltc_*
variables are reset to '' before that block runs, so assigning them in the first case block
would be silently wiped.

Removed for Vista: the "Geen vast pakket" price area, the "Alarm.com · hub…" sub-line (its
`sub` assignment is gone) and the "Bekijk de camerahardware" link along with its CSS. The
camera-hardware page is still linked from the Mijn Thuis `.mt-camhw` band.

## Contracts that must not change (proved byte-identical to 568e760)

- **Lead payload.** The Vista IIFE in `{% javascript %}` sends
  `ZVLeadWebhook.send(rec, 'vista')`, where `'vista'` is a DB CHECK-constrained source code.
  It also fires `ZV.callbackRequestSuccess` (GTM `callback_request`), and keeps its validation
  messages and the success UI. No JS changed.
- **`[data-vista]` line.** `data-odoo`, `data-item` and `data-price` feed `item_id`,
  `item_name` and `monthly_price`.
- **`is_vista` line (forces `price_known = false`).** This is load-bearing. The Vista variant
  has a real Shopify price, so dropping the override would turn `monthly_price` into a euro
  amount instead of "Geen vast pakket". It would also render the dead `pcard__plus` accordions
  and make the modal offer "In winkelwagen" for Vista.
- **Anchor.** There is no `id` on the card. `#mijn-thuis-vista` is resolved by
  `applyHash()`/`focusVista()`: they select the Mijn Thuis tab, scroll `[data-vista]` to the
  centre and focus the first `[data-vista-form] input`. Keep exactly one `[data-vista]` and
  keep Naam as the first form input. The matcher's "Kies Vista", Vergelijk's "Vraag Vista aan"
  and the "Extra camera's" note all depend on this.
- **Tile article data-* attributes.** `cardByFk()` uses them for the Keuzehulp
  `?pakket=secure_plus` modal and for the modal tabs.

## Deliberately unchanged / open

- The consent error "Bevestig dat wij u mogen terugbellen." and the success text "Bedankt. Wij
  bellen u terug over Vista." both sit in the byte-identical lead code.
- The Vista "Meer informatie" modal data (the old sub-line and hook), the matcher's "Camerabeveiliging
  op maat" and the zv-finder.js Vista texts are out of scope.
- Deep links land on the form, not the card top. `focusVista()` centres `[data-vista]` (the
  form), so on a phone the new header and bullets sit above the viewport. Changing that means
  editing the byte-identical JS.
- The icon is an engineering draft, like the Alert/Protect icons: not yet design-signed-off.
- The dead `price_known` accordions (woning/addons/terms) inside the tile article are untouched.
- Vista is now the tallest Mijn Thuis card, so Alert and Protect get more empty space at the bottom
  (via `.ltc__spacer`).
