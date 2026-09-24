# Pakketkaarten Oplossingen — wijzigingen 2026-09-23

Source: `2026_09_wijzigingen_prijzen_zv_website.docx` (feedback on the live Oplossingen page; red text = new, strikethrough = remove). Decisions by Thijs 2026-09-23: follow the feedback as written (including claims); buying ("Koop") becomes a real purchase path; prices are final.
Checked against `origin/main` @ `e903b19` (PR #93, 2026-09-23 10:38).

Copy below is final. Light grammar/house-style fixes (u-vorm, "wifi", "codebedienpaneel", "Alarm.com-app") are applied and marked *(stijl)* where they differ from the feedback wording.

**Out of scope (Thijs, 2026-09-23):** the always-visible call-me-back/adviesgesprek CTAs (already built).

---

## Already done in Shopify (2026-09-23, not in git)

| Product | SKU | Price |
|---|---|---|
| Mijn Thuis Alert | MT-ALE | €24,95 (was €19,95) |
| Mijn Thuis Protect | MT-PRO | €37,95 (was €34,95) |
| Videodeurbel (abonnement) | ABO-VIDEODEURBEL | €19,95 — exists, handle `videodeurbel-abonnement` |
| Afstandsbediening (huur) | ABO-AFSTANDSBEDIENING | €1,25 — exists, handle `afstandsbediening-huur` |

Promo: package ×3 with Shopify's automatic 50% discount, rounded per unit (PR #94, `docs/prepay-qty3-2026-09-23.md`). Alert €37,44 · Protect €56,94 today, already correct on the site. The PROMO-* products are retired, unused and not referenced by the theme. Don't use or reprice them.

**Branch 2 is done:** `main` already has Alert 2495 / Protect 3795 in `pricing.config.json`. Odoo subscription prices for Alert/Protect and the two new monthly products are not changed by this work.

---

## 1. Section intro — `templates/page.oplossingen.json`, `langer_thuis` → `pak_sub`

- Old: "Van extra oogje in het zeil tot compleet vangnet. Privacy-first, zonder camera. +€4/mnd per extra verdieping of 100 m²."
- New: "Van extra oogje in het zeil tot compleet vangnet. Privacy-first, zonder camera."

The surcharge is already explained in the Uitbreidingen panel and the grid footnote. Branch 1.

## 2. Inzicht (`fk == 'aware'`) — branch 1

- **Tagline:** "Rust, weet dat het goed gaat"
- **Bullets:**
  1. Daginzicht in het leefritme van uw dierbare
  2. Mogelijkheid tot een melding bij de eerste beweging van de dag *(stijl)*
  3. En/of een melding bij afwijking van het normale patroon *(stijl)*
  4. Automatische nachtverlichting bij beweging
  5. Familie-app voor mantelzorgers
  6. Geen camera of microfoon
- **Wat zit erin?** `3x activiteiten sensor | 1x deur/raamsensor | Geen meldkamer` (remove "NAMI aiAware")

## 3. Zeker (`aware_plus`) — branch 1

- **Tagline:** "Vroeg weten geeft rust"
- **Intro:** "Alles van Inzicht, plus:" (unchanged)
- **Bullets:**
  1. Signalering bij meer of minder bezoek aan badkamer, keuken of toilet *(stijl)*
  2. Signalering als medicijnen of koelkast niet worden gebruikt *(stijl)*
  3. Directe melding als er mogelijk niet meer gegeten of gedronken wordt *(stijl)*
- **Wat zit erin?** `3x activiteiten sensor | 1x deur/raamsensor | 2x locatiesensor | Geen meldkamer` (remove "NAMI aiCare" and "1x centrale"; activiteiten sensor 1x → 3x; bewegingsmelder → locatiesensor. The feedback's "locatiesensor" overrides the kosten.xlsx name here.)

## 4. Beschermd (`care`) — branch 1

- **Tagline:** unchanged ("Snelle hulp bij nood")
- **Intro (new, via `ltc_intro`):** "Alles van Zeker, plus:"
- **Bullets:**
  1. Nederlandse meldkamer 24/7, with the word "meldkamer" (or the whole bullet) linking to `{% render 'zv-route', key: 'kc/hoe-werkt-een-meldkamer' %}`
  2. Alarmknop met opvolging
  3. Rookmelders met doormelding naar de meldkamer *(stijl)*
  - Remove: "Familie-app en meldingen"
- **Wat zit erin?** `1x centrale | 1x codebedienpaneel | 2x deur/raamsensor | 2x locatiesensor | 2x rookmelder | 3x paniekknop naar keuze | Incl. meldkamer` (remove "Climax"; bewegingsmelder → locatiesensor; paniekknop 1x → 3x)

The bullet-list renderer currently outputs plain text. Adding a link to one bullet needs a small, contained change (for example, allowing a `[tekst](route-key)` marker or a dedicated optional link field). Keep it minimal, and don't let a generic HTML passthrough into bullets.

## 5. Alert (`secure`) — branch 1 (copy) + branch 2 (price in config)

- **Price:** €24,95/mnd
- **Tagline:** unchanged
- **Bullets:**
  1. Slimme detectie met wifi-sensing én bewegingssensoren *(stijl)*
  2. Direct gewaarschuwd bij verdachte activiteit
  3. Overal bedienen met de Alarm.com-app
  4. Eenvoudig in- en uitschakelen via het codebedienpaneel *(stijl: keypad → codebedienpaneel)*
  5. Krachtige ingebouwde sirene
  6. Simuleer aanwezigheid met slimme verlichting
  7. Eenvoudig uit te breiden met extra beveiliging
  8. Geen camera, wel mogelijk als uitbreiding
  9. Geen meldkamer
- **Wat zit erin?** `1x centrale/sirene | 1x activiteiten sensor | 1x bewegingsmelder | 1x deur/raamsensor | 1x codebedienpaneel` (Meldkamer: Nee / Camera: Nee badges unchanged)

## 6. Protect (`guard`) — branch 1 (copy) + branch 2 (price in config)

- **Price:** €37,95/mnd
- **Tagline:** unchanged
- **Bullets** (replace all three current ones):
  1. 24/7 aangesloten op een professionele meldkamer
  2. Directe bescherming tegen inbraak
  3. Bescherming tegen brand en rook
  4. Hulp wordt ingeschakeld wanneer dat nodig is
  5. Overal bedienen via de app
  6. Altijd professionele alarmopvolging als extra vangnet
  7. Uitbreidbaar met surveillance, CO- en waterdetectie
- **Wat zit erin?** unchanged. The feedback shows "1x bewegingsmelder" but it isn't marked as a change; `main` has "1x fotobewegingsmelder". Check the live theme; if live differs, report it and don't change it in this branch.

## 7. Uitbreidingen / Extra diensten — all 5 packages

| Item | Change | Branch |
|---|---|---|
| Domotica (Extra diensten) | Remove from all 5 packages | 1 |
| Ontzorgpakket | Unchanged for now (feedback refers to an earlier e-mail; content to follow from Thijs) | — |
| Magneetcontact, PIR, Rookmelder, Buitencamera 730, Binnencamera SD, Videodeurbel 750 (koop) | Remove from Beschermd + Protect | 3 |
| Afstandsbediening | Beschermd + Protect: switch from `koop-afstandsbediening` (€40 eenmalig) to `afstandsbediening-huur` (€1,25/mnd) | 3 |
| Videodeurbel | New option on all 5 packages: `videodeurbel-abonnement`, €19,95/mnd, with info text (below) | 3 |
| Extra camera's remark | New non-selectable note on all 5 (below), linking to the Vista card | 3 |
| Woning surcharge | New label + 1/2-verdiepingen choice (below) | 4 |

**Videodeurbel info text** (drafted from the feedback's notes):
> Zie en spreek wie er aanbelt, ook als u niet thuis bent. De videodeurbel werkt volledig geïntegreerd in het Alarm.com-platform, met veilige opslag van opnames. Via de app te volgen, ook door mantelzorgers.

(The feedback says "opslag van x dagen". Add the number of days once known; don't guess.)

**Extra camera's remark:**
> Extra binnen- of buitencamera's zijn altijd mogelijk. Dit is maatwerk: bel ons voor advies en een offerte. → *Bekijk Vista* (anchor to the Vista card)

**Woning surcharge:**
- Heading: "Woning groter dan 100 m² en/of meer dan 1 verdieping?"
- Options (single choice, deselectable): "1 extra verdieping of 100 m²" +€4/mnd · "2 extra verdiepingen of 200 m²" +€8/mnd
- Today this is only a `Woning` line-item property (no priced cart line). The new property values must stay readable for Odoo; list every place the value is written (oplossingen.liquid JS ×4, Overzicht) before changing it.

## 8. Pakket-matcher scenarios — `templates/page.oplossingen.json` — branch 1

The feedback prefixes each scenario with the packages it applies to (1 = Inzicht, 2 = Zeker, 3 = Beschermd). The block has a single `package` field. **Confirm first** whether it means "lowest tier that has this" (then set it to the lowest number) before changing values.

| Block | Change |
|---|---|
| s1 "Weet dat de dag goed is begonnen" | 1/2/3 → package inzicht (unchanged) |
| s2 "Zie wanneer er iets verandert" | 1/2/3 → zeker → **inzicht** |
| s3 "Seintje als het stil blijft" | 1/2/3 → inzicht (unchanged) |
| s4 "Waarschuwing bij iets onverwachts" | Title → "Waarschuwing bij iets onverwachts, zoals nachtelijk dwalen" *(stijl)*; 1/2/3 → zeker → **inzicht** |
| **new** | Title "Licht aan bij beweging in de nacht", quote "02:14 — nachtlamp tien minuten aan, ter voorkoming van een val." package inzicht (feedback: "Light my way"; beweging in de nacht schakelt een lamp tien minuten aan ter valpreventie) |
| s5 "Mogelijke val eerder signaleren" | **Remove.** Also remove the same scenario from `templates/page.vergelijk-pakketten.json` (s5) and the section default in `sections/vergelijk-pakketten.liquid` |
| s6 "Zie wanneer een routine verandert" | Title → "Melding wanneer een routine verandert"; 2/3 → zeker (unchanged) |
| s7–s9 | 3 → beschermd (unchanged) |

## 9. Tagline sync (same branch as 2–3)

The old Inzicht/Zeker taglines also appear as defaults in `sections/vergelijk-pakketten.liquid` (`tagline_inzicht`, `tagline_zeker`), `snippets/zv-pakket-matcher.liquid`, and possibly `page.vergelijk-pakketten.json` settings. Update them to the new taglines so the pages don't contradict each other.

## 10. Vista card — branch 5

*Copy revised 2026-09-24 (Thijs): the bullets, the text below the form, the time-field label and the consent wording below are his final text and replace the 2026-09-23 copy.*

Replace the "Geen vast pakket" price area, the "Alarm.com · hub, binnencamera…" subline and the "Bekijk de camerahardware" link with:

- **Title:** Vista
- **Tagline:** "Zie wat er gebeurt. Weet wat ertoe doet."
- **Icon:** new, in the same style as the other ltc card icons (camera/eye motif, `--indigo` + `--red`)
- **Bullets:**
  1. Slimme AI herkent personen
  2. Direct gewaarschuwd bij gebeurtenissen
  3. Altijd live zicht op uw woning
  4. Bekijk wat er vóór en tijdens een incident gebeurde
  5. Slimme zones voorkomen onnodige meldingen
  6. Kijk en spreek rechtstreeks via de camera
  7. Maatwerk
- **Text below the form:**
  > Iedere woning en situatie is anders. Daarom bepalen we samen waar camera's het meeste effect hebben en welke camera het beste past bij iedere plek. Zo krijgt u precies de beveiliging die nodig is.
- **Time field label:** "Wanneer mogen wij bellen?", without "(optioneel)", in both the label and the placeholder
- **Submit button:** "Plan een vrijblijvend adviesgesprek" (was "Verstuur terugbelverzoek")
- **Consent checkbox stays** (AVG). Wording: "Ik geef toestemming dat Zo Veilig contact met mij opneemt." Form fields, `lead_type: 'vista'` and webhook payload are unchanged.

## 11. Koop option — branch 6, blocked until Thijs creates the product(s)

These go in the "Meer informatie" detail modal per package, as a real purchase path:

| Package | Koop (eenmalig) | Daarna per maand | Monthly fee explanation links to |
|---|---|---|---|
| Inzicht | €299 | €9,95 | `kc/wat-is-alarm-com` |
| Zeker | €349 | €9,95 | `kc/wat-is-alarm-com` |
| Beschermd | €799 | €19,95 | `kc/wat-is-alarm-com` + `kc/hoe-werkt-een-meldkamer` (Securitas) |
| Alert | €349 | €9,95 | `kc/wat-is-alarm-com` |
| Protect | €799 | €19,95 | `kc/wat-is-alarm-com` + `kc/hoe-werkt-een-meldkamer` (Securitas) |

Needs: the product handle(s) and SKU(s), whether the monthly part gets its own product, how Koop interacts with the prepaid promo line (probably no promo on Koop), installation choice, and contract term. Add these to `pricing.config.json` before any theme work.

## 12. Mantelzorgdashboard (Alarm.com Wellness) — branch 7

Added 2026-09-23 at Thijs's request.

**What it is:** a new content block on the Langer Thuis tab, placed directly under the pakket-matcher and before the Mijn Thuis tab content (the same position as in the feedback). It applies to all three Langer Thuis packages. It explains the Alarm.com Wellness dashboard that mantelzorgers see in the Familie-app. The dashboard, Sensor Summary included, is available with Inzicht, Zeker and Beschermd.

*Placement since 2026-09-24 (Thijs):* from 1100px wide the block sits beside the pakket-matcher (matcher heading, scenario tiles and "Ons advies" on the left ~2/3, this card on the right ~1/3, tops aligned, four items in one column), with the matcher's comparison table full width below both. Narrower, it stacks: matcher, this block, then the table.

- **Heading:** "Het mantelzorgdashboard"
- **Badge line** (added 2026-09-24, Thijs), a small tag directly under the heading: "Bij alle Langer Thuis-pakketten: Inzicht, Zeker en Beschermd". Theme-editor setting; blank hides it.
- **Intro:** "Via de Familie-app ziet u als mantelzorger in één oogopslag hoe het gaat. Het dashboard is gebouwd op het Wellness-platform van Alarm.com."
- **Four items** (dashboard names as they appear in the Alarm.com app, text from the feedback):
  1. **Dashboard** — activiteitsniveau van vandaag afgezet tegen het persoonlijke gemiddelde, met kleurcodering: groen is routine, geel is opvallend, rood is ongebruikelijk.
  2. **Activity Detail** — weekgrafiek van het activiteitsniveau.
  3. **Sensor Summary** — dagoverzicht per ruimte over 24 uur. ~~Small note under this item: "Bij Inzicht en Beschermd." (as in the feedback)~~ Note removed 2026-09-24 (Thijs): Sensor Summary works with all three packages, so nothing renders under this item. The note setting stays, empty, so a note can be added later in the editor.
  4. **Behaviors and Trends** — vergelijkt gedrag per categorie (keukenbezoeken, in- en uitgaan, activiteitsniveau) met een opgebouwd persoonlijk profiel. *(stijl: "tegen" → "met")*
- **Closing line (emphasised):** "Dit is een lerend gedragsprofiel. Van het grootste belang voor mantelzorgers."
- **Image:** a screenshot of the Alarm.com Wellness dashboard. Use only an official Alarm.com dealer/marketing asset, uploaded by Thijs to Shopify Files — do not pull an image from a random website. The image is a theme-editor `image_picker` setting. While it's empty the image column is not rendered at all (no visible placeholder), and the text takes full width.
- **Link from the cards:** the "Familie-app voor mantelzorgers" bullet on Inzicht can anchor to this block (`#mantelzorgdashboard`) — only if branch 1's bullet-link mechanism is merged; otherwise skip.

All texts are theme-editor settings (heading, badge line, intro, 4 × title/text/note, closing line, image), with the copy above as defaults.

---

## Addendum — decisions from Thijs's mockup (2026-09-23, after review against the docx)

- **§3 Zeker "Wat zit erin?"** keeps "Geen meldkamer" as the last item. The mockup leaves it out; the docx keeps it.
- **§8 matcher:** the `package` field is the lowest tier that has the scenario. The mockup's "Inzicht+" / "Zeker+" labels confirm it. The docx legend "1. Alert, 2. Inzicht, 3. Beschermd" is a slip; read 1/2/3 as Inzicht/Zeker/Beschermd. s8 "Rook en brand op tijd ontdekt" and s9 "Opvolging aan huis mogelijk" stay two separate blocks. The mockup draws them as one tile, but that's only the drawing.
- **§10 Vista:** order under the form fields is consent checkbox, then the "Iedere woning en situatie is anders…" text, then the "Plan een vrijblijvend adviesgesprek" button. The docx strikes the consent line, but the checkbox stays on purpose for AVG.
- **§12 Sensor Summary note:** the docx says "alleen inzicht en bescherm". Confirmed by Thijs: keep "Bij Inzicht en Beschermd." It's a theme-editor setting, so it can be changed later without code.
  - **Superseded 2026-09-24 (Thijs):** the note is removed (empty in `page.oplossingen.json` and no schema default), because the dashboard, Sensor Summary included, is available with Inzicht, Zeker and Beschermd. A badge line under the heading now says so: "Bij alle Langer Thuis-pakketten: Inzicht, Zeker en Beschermd". Same day, the block moved beside the pakket-matcher from 1100px (see §12).
