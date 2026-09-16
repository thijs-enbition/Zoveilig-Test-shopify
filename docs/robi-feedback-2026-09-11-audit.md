# Robi feedback audit — 2026-09-11

Source: Robi's first-pass feedback on the dev store (homepage + Oplossingen page,
Langer Thuis tab in detail; the Mijn Thuis tab note was unfinished in the source doc,
so item (g) below is a from-scratch contrast pass rather than a fix for a specific
element Robi named).

Checked live against `zoveiligdev.myshopify.com` via `shopify theme dev` (local proxy)
and Playwright (Chrome), on branch `fix/robi-feedback-2026-09-11`.

---

## Flagged only — not built (needs Thijs's decision)

Robi asked for a persistent CTA on every page (phone/email) that automatically creates
a lead in Odoo. **This conflicts with ADR-004** (Odoo sync deferred to Phase 2 — leads
currently go to Supabase's `leads` table with `odoo_sync_status='not_ready'`, per the
contact-form work in `ac10dbf`). No live Odoo write path was built. Two ways forward
once Thijs decides:
- Extend the existing `ZV_LEAD_ENDPOINT` webhook pipeline (already used by the contact
  form) to also handle a persistent-CTA lead, still landing in Supabase with
  `not_ready` status until Phase 2.
- Wait for Phase 2 and build the Odoo write path properly then.

---

## Step 1 — Audit findings

### a) "Lees ons verhaal" link goes nowhere
**File:** [sections/story.liquid:19](sections/story.liquid#L19) — `href="{{ section.settings.link | default: '#' }}"`.
**Confirmed live:** the rendered `<a class="sc-link">` has `href="#"`.
**Cause:** `templates/index.json`'s `"story"` section sets `eyebrow`/`heading`/`text`/`link_text`
but never sets the `link` URL setting, so it falls through to the `#` default.
**Fix:** set `settings.link` on the `story` section in `templates/index.json` to wherever
"ons verhaal" should point (`/pages/over-ons`? — no dedicated story/about page was found
under that exact content in this repo; needs Thijs to confirm the target page before this
is a one-line change).

**Fixed 2026-09-11** (branch `fix/lees-ons-verhaal-link`): `/pages/over-ons` is a real,
resolving page (`templates/page.over-ons.json`, already linked from the footer via
`{% render 'zv-route', key: 'over-ons' %}` in `sections/zv-footer.liquid`) — confirmed live
via Playwright against a throwaway unpublished theme, not guessed. Set
`templates/index.json`'s `"story"` block `settings.link` to `/pages/over-ons`.

**Audit note — same `default: '#'` pattern elsewhere:** this isn't a hardcoded `"#"`
anywhere in schema; it's a standard Liquid fallback (`| default: '#'`) used across many
sections for an *optional*, merchant-configurable URL setting, so it isn't inherently a
bug — a section only renders a dead `#` link if the setting is left unconfigured in the
JSON template that uses it, same root cause as this one. Other places using the identical
`default: '#'` pattern, not checked here for whether their setting is actually configured
(none fixed, per this task's scope — only (a) above was in scope):
[sections/zv-header.liquid:71](sections/zv-header.liquid#L71) (`cta_link`),
[sections/kc-hero.liquid:34](sections/kc-hero.liquid#L34) (block `link`),
[sections/kc-bridge.liquid:24](sections/kc-bridge.liquid#L24) (`cta_link`),
[sections/kc-cta-band.liquid:24,35](sections/kc-cta-band.liquid#L24) (`primary_link`,
`secondary_link`), [sections/cta-block.liquid:36,39](sections/cta-block.liquid#L36)
(`primary_button_link`, `secondary_button_link`),
[sections/finder-preview.liquid:56](sections/finder-preview.liquid#L56) (block `link` /
`finder_url`), [sections/faq.liquid:55,61,67](sections/faq.liquid#L55) (`btn1_link`,
`btn2_link`, `btn3_link`), [sections/oplossingen.liquid:319](sections/oplossingen.liquid#L319)
(`walkthrough_url`). Worth a follow-up pass to confirm each is actually configured wherever
it's used in a JSON template.

### b) "Help mij kiezen" / "Start de Keuzehulp" CTAs land at an awkward scroll position
**Files:** [sections/hero-banner.liquid:97-99](sections/hero-banner.liquid#L97-L99) (hero
CTAs), [sections/faq.liquid:118](sections/faq.liquid#L118) (btn1, `/#keuzehulp` default),
[sections/finder-preview.liquid:12](sections/finder-preview.liquid#L12) (`id="keuzehulp"`
target).
**Confirmed live:** the header/announcement bar is `position: sticky` and measures **117px**
tall (`.shopify-section-group-header-group`, see
[assets/zv-chrome.css:79](assets/zv-chrome.css#L79)). `#keuzehulp` has **no
`scroll-margin-top`**, so a same-page anchor jump lands the section's top edge exactly at
the viewport top — behind/under the sticky header. Screenshot after clicking the hero CTA
shows the Keuzehulp heading cut off by the header. Other anchor-jump targets in the theme
(`.zv-article .prose h2`, `.zv-policy-page .lg-sec`) already compensate with
`scroll-margin-top: 90-132px` — `#keuzehulp` is the one target missing this.
**Fix:** add `scroll-margin-top` (~130px, matching the sticky header + some breathing room)
to `.finder-sec` in [sections/finder-preview.liquid](sections/finder-preview.liquid). Not
applied yet — leaving all Step 1 items as report-only per the brief.

### c) Only Securitas is a clickable logo in the partner strip
**File:** [sections/trust-partners.liquid](sections/trust-partners.liquid) — code already
handles this correctly: a partner chip renders as `<a href="{{ partner.website }}">` only
`if partner.website != blank`, otherwise a plain `<span>`.
**Confirmed live (DOM):** Securitas renders as `<a href="https://www.securitas.nl"
title="Securitas">`; the other three chips render as bare `<span>` with **no `title` and no
`href`** — meaning their `partner` metaobject entries currently have neither `website` nor
`partner_name`/`internal_name` filled in (the `title`/alt text comes from `partner_name`,
which is also empty).
**Verdict: not a code bug, a data-entry gap.** Someone needs to fill in `website` (and ideally
`partner_name` for accessible alt text) on the nami / Climax / Alarm.com `partner`
metaobject entries in Shopify admin — no theme change required.

### d) Stray "Ons advies: ." + a bare circular arrow button on the Langer Thuis pakket-matcher
**Files:** [snippets/zv-pakket-matcher.liquid:97-104](snippets/zv-pakket-matcher.liquid#L97-L104)
(markup), [assets/zv-vergelijk-pakketten.css:55](assets/zv-vergelijk-pakketten.css#L55) and
[assets/zv-chrome.css:48](assets/zv-chrome.css#L48) (root cause), rendered on Oplossingen via
[sections/oplossingen.liquid:229](sections/oplossingen.liquid#L229).
**Confirmed live + screenshot:** on page load, before any scenario card is selected, the
`.pm-advies` bar is fully visible reading **"Ons advies: ."** (the literal markup is
`{{ advies_label }} <span data-pm-name></span>.` — `data-pm-name` is empty until JS fills it
in) with a gold circular icon-only button next to a fully-rendered "Bekijk winkelwagen"
button.
**Root cause — CSS specificity bug, not a JS bug.** The JS
(`assets/zv-vergelijk-pakketten.js`) correctly manages the `hidden` attribute (`advies.hidden
= true/false` on scenario selection, and the element starts with `hidden` in the server
markup). But:
- `.zv-vergelijk .pm-advies { display:flex; ... }` and
- `.btn { display: inline-flex; ... }` (used by the "Bekijk winkelwagen" link)

are **author-origin CSS rules that set `display`, and author-origin rules always beat the
user-agent's `[hidden] { display: none }` rule regardless of specificity** (per the CSS
cascade, origin/importance is resolved before specificity). So the `hidden` attribute is
present in the DOM and correctly toggled by JS, but has zero visual effect — the advice bar
and its buttons are permanently visible.
Playwright confirms exactly this: `.pm-advies` → `hiddenAttr: true, computedDisplay: "flex"`;
the "Bekijk winkelwagen" link → `hiddenAttr: true, computedDisplay: "inline-flex"`; the
add-to-cart button → `hiddenAttr: false` (correct, it's meant to be visible-but-disabled by
default) with empty text (`data-pm-add-text` unset until a scenario is picked), which is
what reads as "a small circular arrow button that goes nowhere."
**Proposed fix:** add `[hidden] { display: none !important; }` scoped to `.zv-vergelijk` (or
just `.zv-vergelijk .pm-advies[hidden], .zv-vergelijk [hidden]`), or switch the JS to toggle a
`.is-hidden` class instead of the `hidden` attribute. Not applied — Step 1 is report-only.

### e) Comparison table "Kies Inzicht/Zeker/Beschermd" buttons do nothing
**File:** [snippets/zv-pakket-matcher.liquid:144-146](snippets/zv-pakket-matcher.liquid#L144-L146)
— `<a href="{{ opl }}">Kies …</a>` where `opl = opl_url | default: '/pages/oplossingen'`.
**Confirmed live:** all three buttons render `href="/pages/oplossingen"`.
**Cause:** on the standalone `/pages/vergelijk-pakketten` page this makes sense (it navigates
the visitor to Oplossingen to actually buy). But [sections/oplossingen.liquid:229-235](sections/oplossingen.liquid#L229-L235)
renders this same snippet **embedded on the Oplossingen page itself**, without passing an
`opl_url` override — so the buttons link back to the current page. Clicking one just reloads
`/pages/oplossingen` (no anchor/hash even), which looks and feels like "does nothing."
**Open question, not a one-line fix:** what should these buttons do when already embedded on
Oplossingen? Two reasonable options: (1) scroll up to the matching package card in the row
above (`data-pm-pkg` already identifies inzicht/zeker/beschermd, so this is a small JS
addition), or (2) add-to-cart directly like the package cards' own "In winkelwagen" buttons.
Needs a product decision before implementing.

### f) Footer missing on the Oplossingen page
**File:** [sections/zv-footer.liquid:11-13](sections/zv-footer.liquid#L11-L13):
```
{%- comment -%} The Oplossingen page ends at its own "De beste technologie" band (as in the
  design pack), so the global footer is intentionally not rendered on that template. {%- endcomment -%}
{%- unless template.suffix == 'oplossingen' -%}
```
**Confirmed live:** `footer.foot` is absent on `/pages/oplossingen` and present on
`/pages/vergelijk-pakketten` (and other pages). This is **an existing, deliberate design
decision**, not a bug or a regression — the footer-group section itself renders globally from
`layout/theme.liquid`; `zv-footer.liquid` is the one that opts itself out for this specific
template.
**Open question:** was this the right call? The page as a result has no legal links
(privacy/herroepingsrecht), no secondary nav, no contact info below the partner band — Robi's
complaint suggests visitors expect a footer here regardless of the design-pack intent. If the
decision is to reinstate it, the fix is a one-line removal of the `unless` guard; if the
intentional omission should stand, this needs a documented "no" so it doesn't get
re-flagged as a bug again.

### g) Mijn Thuis tab contrast pass (Robi's note was unfinished/vague — no specific element named)
Ran a full contrast pass against the live rendered Mijn Thuis tab (`getComputedStyle`, walking
up to the nearest solid ancestor background where the element's own background is
transparent) and checked every text/background pair against WCAG AA (4.5:1 normal text,
3:1 for ≥24px or ≥18.66px-bold). **20 failing text/background pairs found, all resolving to
the same two underlying tokens:**

| Selector | Text example | Color | On background | Ratio | Needed |
|---|---|---|---|---|---|
| `.vhero__eye`, `.why__eye`, `.why__link`, `.pcard__plus-pr` | "Mijn Thuis", "Waarom Zo Veilig", "+€4/mnd", "Prijs volgt" | `#b67e0a` (the `--belt` gold token) | white / cream (`#fffdf8`–`#fdfaf2`) | **3.4–3.5 : 1** | 4.5 : 1 |
| `.pcard__sub` | "NAMI Alarm15 · Alarm Pod, SensePlug, PIR…" | `rgb(140,132,166)` (muted purple-gray) | white | **3.52 : 1** | 4.5 : 1 |
| `.pcard__vista-done` | "Bedankt. Wij bellen u terug over Vista." | `rgb(47,143,91)` (success green) | white | **4.04 : 1** | 4.5 : 1 |

**This is not Mijn-Thuis-specific — it's a theme-wide design-token issue.** `--belt: #b67e0a`
is defined and reused as a text color in 15+ files across the whole theme (eyebrows, small
labels, links — `assets/zv-chrome.css`, `assets/zv-kc.css`, `assets/zv-article.css`,
`sections/over-ons.liquid`, `sections/hero-banner.liquid`, etc.), all at font sizes (12.5–15px)
that don't qualify for the 3:1 "large text" exemption. It shows up prominently on Mijn Thuis
because that tab's package cards use it repeatedly for price labels
(`.pcard__plus-pr`), which is likely what Robi noticed, but fixing it only on Mijn Thuis would
leave the same failure everywhere else `--belt` is used for text. **Needs a design decision**
(darken `--belt` to something ≥4.5:1 on white/cream, e.g. closer to `#8a5f08`, and separately
darken the muted-gray `.pcard__sub` token) rather than a scoped Oplossingen fix. No text-on-photo
overlay elements were found on this tab (0 image-background text nodes flagged), so this is
purely a solid-color contrast issue.

### h) "Meldkamer directe connectie met 112" claim
**Files:** `templates/page.oplossingen.json:106` (`s8` scenario block, Langer Thuis /
"Beschermd" package, row 3) and, **also present in two more places** with the identical
string:
- `templates/page.vergelijk-pakketten.json:13`
- `sections/vergelijk-pakketten.liquid:150` (the section's own schema default — used if a
  merchant adds a fresh instance of this section without overriding block `s8`)

Current text everywhere: **"06:38 brandalarm, meldkamer directe connectie met 112."**
**Not changed** — factual/compliance claim, needs the real Securitas process confirmed with
Thijs first (Robi: the private meldkamer verifies before alerting 112, it doesn't have a
direct line). Once the correct wording is confirmed, all three locations above need updating
together, or they'll drift.

---

## Step 2 — Bounded fixes applied on this branch

1. **Homepage hero heading** "Langer veilig thuis" → "Veilig thuis, in elke levensfase" —
   **not applied in this repo.** The hero heading is not theme code — it's the `heading`
   field on the active `hero_banner` metaobject entry in Shopify admin
   ([sections/hero-banner.liquid:15-16](sections/hero-banner.liquid#L15-L16)). Thijs is
   making this change directly in Admin.

2. **Duplicate keuzehulp CTA** — fixed in
   [templates/index.json](templates/index.json):
   - `finder_cta` section: added `"heading": ""` to blank the homepage Keuzehulp card's own
     "Niet zeker wat bij u past?" h2 (its eyebrow, body copy and the Lio character stay —
     nothing else depended on this heading).
   - `faq` section: added `"close_heading": "Twijfelt u wat bij u past?"`, replacing the
     default "Niet zeker welke ondersteuning past?" on the FAQ section's closing CTA block.
   This block's three buttons ("Start de Keuzehulp" / "Bezoek het kenniscentrum" / "Waar
   kunnen we u mee helpen?") are wrapped in the same `{% if close_heading != blank %}` as the
   heading — blanking it instead of the finder-preview heading would have deleted all three
   buttons, so the surviving/reworded instance had to be this one. Verified live: exactly one
   "Twijfelt u wat bij u past?" now renders on the homepage, both old strings are gone, and
   all three FAQ CTA buttons are still present.

3. **Veilig Onderweg tab subtitle "Onderweg"** — removed. Fixed in
   [templates/page.oplossingen.json](templates/page.oplossingen.json): blanked
   `sublabel` on the `veilig_onderweg` block (was `"Onderweg"`). Verified live: the tab now
   reads only "Veilig Onderweg", the other two tabs are unaffected.

4. **Langer Thuis "zonder camera's waar dat niet nodig is" copy** — **not applied in this
   repo.** Also not theme code: it's the `descripbtion` field (sic — typo in the metaobject's
   field key, confirmed immutable in
   [sections/feature-cards.liquid:81](sections/feature-cards.liquid#L81)) on the `langer-thuis`
   `feature_card` metaobject entry. Thijs is making this change directly in Admin.
   Suggested replacement text for reference: *"Langer Thuis werkt zonder camera's of
   microfoons, met de optie om dit uit te breiden met camera's — te bekijken via dezelfde
   app."* (confirm it reads naturally before saving).

**Admin checklist for Thijs (items 1 and 4 above — not in this PR):**
| Where (Shopify admin) | Field | Old text | New text |
|---|---|---|---|
| Metaobjects → Hero banner → the active entry | `heading` | Langer veilig thuis | Veilig thuis, in elke levensfase |
| Metaobjects → Feature card → `langer-thuis` entry | `descripbtion` | …Zonder camera's waar dat niet nodig is. | Langer Thuis werkt zonder camera's of microfoons, met de optie om dit uit te breiden met camera's — te bekijken via dezelfde app. (adjust to taste) |

---

## Step 3 — Report only, unresolved (needs Thijs / Robi decisions)

**FAQ title/quote pairs, all 6 (homepage, `faq_item` metaobjects, sorted by
`display_order`):**

| # | Topic/title | Quote | Note |
|---|---|---|---|
| 01 | De dagelijkse check | "Sinds mijn moeder alleen woont, bel ik haar eigenlijk iedere avond." | consistent |
| 02 | Ik wil haar niet controleren | "Ik wil haar niet controleren." | **title == quote, verbatim** |
| 03 | Wanneer is het tijd om in te grijpen? | "Wanneer weet ik dat ik moet ingrijpen?" | consistent (near-paraphrase) |
| 04 | Ik voel me verantwoordelijk | "Als mijn vader de telefoon niet opneemt, schrik ik meteen." | consistent |
| 05 | We hebben een familieschema gemaakt | "Wie houdt eigenlijk een oogje in het zeil als ik er niet ben?" | **title doesn't match quote** |
| 06 | Ze wil absoluut niet verhuizen | "Mijn moeder wil het liefst zo lang mogelijk zelfstandig blijven wonen." | consistent |

All 6 are Langer Thuis / mantelzorg scenarios — confirms Robi's point that there's currently
zero Mijn Thuis or Veilig Onderweg FAQ coverage. Needs real replacement copy for #2 and #5,
plus new Mijn Thuis / Veilig Onderweg questions — content decision, not implemented.

**Langer Thuis pricing cards — looptijd not shown.** Confirmed real per-package contract term
from `pricing.generated.json` (via `pricing/pricing.config.json`, not guessed): **Inzicht,
Zeker and Beschermd are all 36 months.** (For reference, on Mijn Thuis: Alert is 12 months,
Protect is 36; Vista has no term yet, `pricingStatus: PRICE_PENDING`.) Needs a decision on
exactly where/how "Looptijd: 36 maanden" should appear on the card before "In winkelwagen" —
not implemented.

**Uitbreidingsregel wording** — confirmed two different phrasings for the same €4/extra-floor
rule live side by side on every Langer Thuis package card right now: the collapsible label
reads *"Woning groter dan 100 m²?"* while its own answer reads *"Ja, per extra etage +€4/mnd"*
([sections/oplossingen.liquid](sections/oplossingen.liquid), pcard markup) — and the card
intro text separately says *"Alle abonnementen: +€4 p/m per extra etage."*
(`templates/page.oplossingen.json` → `pak_sub`). Needs one canonical phrasing, used in both
places — not implemented.

**Price notation — three different formats confirmed live in the same flows:**
- `€ 19,95` (space after €) — comparison table / pricing pipeline (`zv-pricing.liquid`,
  `pricing.generated.json`)
- `€19,95/mnd` (no space, "/mnd") — package cards (`sections/oplossingen.liquid`)
- `+€4 p/m` (space, "p/m") — `pak_sub` intro text — vs. `+€4/mnd` in the card itself

Needs one notation picked theme-wide — not implemented (this touches the pricing pipeline
output format, so should go through `scripts/build_pricing.py`/`check_pricing.py`, not a
manual per-file edit).

**Jargon vs. plain language**, confirmed live on the Langer Thuis cards: "PIR" and
"magneetcontacten" appear verbatim (Beschermd card: *"1 centrale/hub, 2 magneetcontacten, 2
PIR…"*); "centrale/hub" also appears as-is. The same physical stekker-sensors are named
**"wifi-sensorstekkers"** under Inzicht and **"activiteitssensoren"** under Zeker — needs one
name picked. Not implemented (copy decision).

**"Abonnementen" button vs. "Uitbreidingen toevoegen" vs. "Meer informatie"** — confirmed all
three exist as separate controls on every package card
([sections/oplossingen.liquid:183-185](sections/oplossingen.liquid#L183-L185) for
"Abonnementen", a `<details>`/`<summary>` revealing Domotica/Ontzorgpakket checkboxes, both
currently "Prijs volgt"/unpriced). The distinction between this and "Uitbreidingen toevoegen"
(Huisdier-upgrade / Extra sensoren / Extra toegangspunten) isn't self-evident from the UI —
confirms Robi's point. UX decision needed, not a copy fix.

**Package card redesign** — Robi's two reference mockups (a plainer comparison-style card, and
a step-based "kies pakket → woning grootte → installatie" flow) are reference images, not
literal designs to copy. Needs a proper design/scope pass before any implementation.

---

## Decisions needed from Thijs (single list, answer in one pass)

1. **Odoo lead-capture CTA** — extend the existing Supabase/`ZV_LEAD_ENDPOINT` pipeline now
   (still `not_ready` for Odoo), or wait for Phase 2?
2. **"Lees ons verhaal" link target** — which page/URL should it point to?
3. **Pakket-matcher scroll-margin fix** (item b) and **CSS `[hidden]` specificity fix** (item
   d) — both have a clear, low-risk proposed fix. OK to implement in a follow-up, or do you
   want to review the reasoning first?
4. **Vergelijk-pakketten "Kies X" buttons on the Oplossingen embed** (item e) — scroll to the
   matching card above, or add-to-cart directly?
5. **Footer on Oplossingen** (item f) — reinstate the global footer, or confirm the
   intentional "ends at the partners band" design should stand?
6. **`--belt` gold token contrast** (item g) — approve a darker gold (and darker muted-gray)
   for text use, or keep as-is and only use it for large/decorative text going forward?
7. **112 / meldkamer copy** (item h) — what's the real Securitas verify-then-alert wording,
   for all three locations?
8. **FAQ #2 and #5** — real replacement titles/quotes, and at least one Mijn Thuis + one
   Veilig Onderweg FAQ question.
9. **Looptijd on pricing cards** — confirm placement/wording (real terms: Inzicht/Zeker/
   Beschermd = 36 mo; Alert = 12 mo; Protect = 36 mo; Vista = pending).
10. **Uitbreidingsregel wording** — one canonical phrase for the €4/extra-floor rule.
11. **Price notation** — pick one format (`€ 19,95` / `€19,95/mnd` / `+€4 p/m` are all live
    today).
12. **Jargon** — plain-language replacements for PIR / magneetcontacten / centrale-hub, and
    one name for the wifi-sensorstekkers ↔ activiteitssensoren stekkers.
13. **"Abonnementen" card button** — what should it do differently from "Uitbreidingen
    toevoegen" and "Meer informatie"?
14. **Package card redesign** — scope this as its own design pass (not a quick swap)?
