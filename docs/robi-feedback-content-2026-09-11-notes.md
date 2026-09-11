# Robi feedback, second pass — FAQ draft + PR notes (2026-09-11)

Companion to branch `fix/robi-feedback-content-2026-09-11`. Covers the one item from
the second-pass prompt that couldn't go into the branch as code — the FAQ (item 2) —
plus the exact text to paste into the PR description when opening it from the compare
link, per the prompt's validation requirements.

## FAQ (item 2) — Admin-only, not in this branch

Like the hero heading and the Langer Thuis feature-card description in the first pass,
FAQ content is entirely driven by the `faq_item` metaobject (`category`, `question`,
`answer`, `display_order`, `active` — see `sections/faq.liquid`). There's no theme file
to edit; this is a checklist for the Shopify admin.

Field mapping, since the on-page labels don't match the metaobject field names 1:1:
- **"Title"** (the small topic label above the quote, e.g. "De dagelijkse check") =
  the `category` field.
- **"Quote"** (the italic first-person line) = the `question` field.
- **Answer** = the `answer` field ("Zo Veilig ...").

### Current 6 entries, with the two requested fixes

| # | category (title) | question (quote) | Fix |
|---|---|---|---|
| 01 | De dagelijkse check | "Sinds mijn moeder alleen woont, bel ik haar eigenlijk iedere avond." | none — keep |
| 02 | ~~Ik wil haar niet controleren~~ → **Privacy staat voorop** | "Ik wil haar niet controleren." | retitled — was identical to the quote |
| 03 | Wanneer is het tijd om in te grijpen? | "Wanneer weet ik dat ik moet ingrijpen?" | none — not in scope, see recommendation below |
| 04 | Ik voel me verantwoordelijk | "Als mijn vader de telefoon niet opneemt, schrik ik meteen." | none — keep |
| 05 | ~~We hebben een familieschema gemaakt~~ → **Een extra paar ogen, ook als u er niet bent** | "Wie houdt eigenlijk een oogje in het zeil als ik er niet ben?" | retitled — old title didn't match the quote at all |
| 06 | Ze wil absoluut niet verhuizen | "Mijn moeder wil het liefst zo lang mogelijk zelfstandig blijven wonen." | none — keep |

### Question-mix recommendation (your call — "keep whichever 3 read strongest")

All 6 are currently mantelzorg-framed. My pick for the 3 to keep active: **01, 04, 06**
— together they cover three distinct angles (checking-in anxiety, sudden-fear moments,
reluctance to relocate) without overlapping. I'd deactivate **02, 03, 05**: even
retitled, 02 and 05 both sit in the same "who's keeping watch" territory as 01, and 03
("wanneer moet ik ingrijpen") overlaps with both. If you'd rather keep 4 or 5 of them
instead of a hard cut to 3, the retitled versions of 02/05 above are still ready to use
as-is.

**To apply:** in the `faq_item` metaobjects, set `active: false` on whichever of
02/03/05 you're dropping, retitle the `category` field on any you keep from that group,
and add the two new entries below.

### New — Mijn Thuis (title given, quote/answer drafted)

| Field | Value |
|---|---|
| category | Wat gebeurt er als mijn alarm afgaat? |
| question | "M'n alarm ging af terwijl ik op vakantie was — ik werd meteen gebeld." |
| answer | Onze meldkamer controleert het alarm en neemt direct contact met u op. Neemt u niet op? Dan bellen we uw contactpersonen. Is ingrijpen nodig, dan schakelt de meldkamer direct de hulpdiensten in. |
| active | true |

(The answer's closing line deliberately reuses the "schakelt direct de hulpdiensten in"
wording from the 112 fix elsewhere in this branch, for consistency.)

### New — Veilig Onderweg (title + quote + answer, all drafted)

| Field | Value |
|---|---|
| category | Wat als ik onderweg val en niet meer kan drukken? |
| question | "Ik ben gevallen op straat en kon de paniekknop niet meer bereiken." |
| answer | Zo Veilig Onderweg herkent een val automatisch en waarschuwt de meldkamer, ook als u zelf niet kunt reageren. De meldkamer neemt direct contact op en schakelt indien nodig hulp in. |
| active | true |

**Both new entries are drafted copy, not reviewed by Robi — read them over (and ideally
have Robi glance at them) before publishing.**

---

## PR description — paste this in when opening the PR

*(Per the prompt: "don't open the PR yourself" — this is ready for you to paste in from
the compare link.)*

### Summary
Second pass on Robi's 2026-09-11 feedback: 12 of the 14 remaining audit decisions
(package-card structure redesign excluded, coming separately). Covers the 112 wording
correction, Langer Thuis pricing-card looptijd, uitbreidingsregel wording, price
notation, jargon cleanup, and the "Abonnementen" accordion relabel.

### Flags for review
- **FAQ (item 2):** two new Q&A entries are drafted in
  `docs/robi-feedback-content-2026-09-11-notes.md` (one Mijn Thuis, one Veilig
  Onderweg) — **this is unreviewed copy, not signed off by Robi.** FAQ content lives
  in the `faq_item` metaobject, not in this branch; see that doc for the full Admin
  checklist (which entries to deactivate/retitle, exact new field values).
- **wifi-sensorstekkers naming:** standardized the Inzicht/Zeker wifi plug-sensor
  naming on "wifi-sensorstekkers" (Zeker previously said "activiteitssensoren" for the
  same product). This was a judgment call with no strong signal either way — easy to
  flip to "activiteitssensoren" instead if you prefer that term.
- **"Extra diensten (optioneel)" relabel:** renamed from "Abonnementen" and added a
  one-line explainer to distinguish it from "Uitbreidingen toevoegen". I can't fully
  judge from code whether this resolves Robi's confusion — worth a look once it's live,
  may still need a real UX pass (a fourth accordion for what's effectively "services"
  vs. "hardware" is still a lot of collapsed options on one card).

### Test plan
- `shopify theme check` clean.
- Pushed to a disposable unpublished theme and validated against Shopify's real
  GitHub-sync validator (deleted after).
- `python3 scripts/check_pricing.py` passes (pricing.config.json was touched to keep
  its "sub" copy in sync with the jargon cleanup, then regenerated via
  `build_pricing.py`).
- Manually verified live via the theme dev preview: looptijd line on all three Langer
  Thuis cards, uitbreidingsregel wording, price notation, and all three package detail
  drawers (Inzicht/Zeker/Beschermd) for leftover jargon.
