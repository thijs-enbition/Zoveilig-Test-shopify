# Homepage FAQ ("Uit de praktijk") — broaden + title/quote fix, draft copy (2026-09-14)

Continuation of the 2026-09-11 Robi feedback audit
([docs/robi-feedback-2026-09-11-audit.md](robi-feedback-2026-09-11-audit.md),
[docs/robi-feedback-content-2026-09-11-notes.md](robi-feedback-content-2026-09-11-notes.md)),
which first flagged the card #2/#5 title/quote mismatch and the all-Langer-Thuis skew.

**This is a content proposal only. Nothing has been implemented, committed, or pushed.**
Worktree: `~/zoveilig/zv-faq-broaden`, branch `docs/homepage-faq-broaden-2026-09-14`.

## Where this content actually lives

There is no theme/Liquid file to edit for this change. [sections/faq.liquid](../sections/faq.liquid)
only renders `shop.metaobjects.faq_item.values` (`where: 'active', true`, `sort: 'display_order'`);
the six cards are entries in Shopify's `faq_item` metaobject definition, edited in
**Shopify Admin → Content → Metaobjects → FAQ item**. Field mapping (on-page label →
metaobject field, confirmed against the live store 2026-09-14 via `shopify theme console`):

- **Title** (small topic label above the quote) = `category`
- **Quote** (italic first-person line) = `question`
- **Answer** = `answer` (rich text)
- `internal_name` and `display_order` are admin-only, not rendered

Live pull also found **9 total `faq_item` entries, only 6 active** — the other 3 are presumably
the two Mijn Thuis / Veilig Onderweg drafts already written up in the 2026-09-11 notes doc, plus
one more. Not inspected further here since they're inactive and out of scope for this task, but
worth a quick look before Step 5 in case one collides with what's proposed below.

## Baseline audit (verbatim, live, before any change)

| # | category (title) | question (quote) | answer | Verdict |
|---|---|---|---|---|
| 1 | De dagelijkse check | "Sinds mijn moeder alleen woont, bel ik haar eigenlijk iedere avond." | Dat begrijpen we. U ontvangt alleen een melding wanneer er iets verandert. Zo hoeft u niet steeds zelf te controleren. | consistent |
| 2 | Ik wil haar niet controleren | "Ik wil haar niet controleren." | Dat hoeft ook niet. Zo Veilig gebruikt geen camera's of microfoons, maar slimme sensoren die veranderingen in dagelijkse routines herkennen. | **title == quote, verbatim** |
| 3 | Wanneer is het tijd om in te grijpen? | "Wanneer weet ik dat ik moet ingrijpen?" | U ontvangt alleen een melding wanneer daar aanleiding voor is. Zo weet u wanneer extra aandacht nodig is, zonder voortdurend mee te kijken. | title is a near-verbatim rephrase of the quote (same question, same structure) — not a bug per the letter of "never a verbatim copy," but the same smell; retitled below as a true theme label |
| 4 | Ik voel me verantwoordelijk | "Als mijn vader de telefoon niet opneemt, schrik ik meteen." | Dat gevoel herkennen veel mantelzorgers. Alleen wanneer er écht iets afwijkt, ontvangt u een melding. | consistent |
| 5 | We hebben een familieschema gemaakt | "Wie houdt eigenlijk een oogje in het zeil als ik er niet ben?" | Langer Thuis helpt u daarbij. Slimme sensoren geven alleen een melding wanneer daar aanleiding voor is. Zo blijft een dierbare zelfstandig wonen, met een gerust gevoel voor u. | **title doesn't reflect the quote at all** |
| 6 | Ze wil absoluut niet verhuizen | "Mijn moeder wil het liefst zo lang mogelijk zelfstandig blijven wonen." | Precies daarvoor is Langer Thuis ontwikkeld. Zelfstandig wonen, met een extra oogje in het zeil wanneer dat nodig is. | consistent |

All 6 are Langer Thuis / mantelzorg, and all 4 kept cards below share the same "volwassen kind
belt ouder" framing except #3 (already persona-neutral) — confirms the brief's "don't all center
on one persona" note.

## Proposed 6 cards (4 Langer Thuis / 2 Mijn Thuis = ~70/30)

Cards 1, 3, 4, 6 keep their `display_order` and concept; 2 and 5 become new Mijn Thuis entries.
Every title below is a theme label, never the quote restated — including #1, #4 and #6 which
were already fine, and #3, which technically passed the letter of the old rule but repeated the
quote's own question structure.

### Card 1 — Langer Thuis (kept, unchanged) — persona: volwassen kind (over moeder)
- **Title (`category`):** De dagelijkse check
- **Quote (`question`):** "Sinds mijn moeder alleen woont, bel ik haar eigenlijk iedere avond."
- **Answer:** Dat begrijpen we. U ontvangt alleen een melding wanneer er iets verandert. Zo hoeft u niet steeds zelf te controleren.
- *No change — reads as a clean baseline for the "volwassen kind" persona; nothing to fix.*

### Card 2 — Mijn Thuis (new) — general home security, not eldercare
- **Title (`category`):** Gemoedsrust op afstand
- **Quote (`question`):** "Ik ben vaak van huis voor werk, ik wil gewoon weten dat alles goed is."
- **Answer:** Mijn Thuis houdt dat voor u in de gaten. Deur- en raamsensoren en een bewegingsmelder signaleren wanneer er iets verandert in uw woning. U ontvangt alleen een melding bij een werkelijke verandering — geen camera's, geen microfoons, gewoon rust in uw hoofd.
- Suggested `internal_name`: "Mijn Thuis — van huis voor werk"
- Covers: deur-/raamsensor + bewegingsmelder named explicitly, no camera's/microfoons (per the
  brief), alert-on-real-change framing kept consistent with the Langer Thuis cards' "alleen een
  melding wanneer..." pattern so the section still reads as one voice.

### Card 3 — Langer Thuis (kept, retitled) — persona: mantelzorger (generic, no stated relation)
- **Title (`category`):** ~~Wanneer is het tijd om in te grijpen?~~ → **Het juiste moment**
- **Quote (`question`):** "Wanneer weet ik dat ik moet ingrijpen?" *(unchanged)*
- **Answer:** U ontvangt alleen een melding wanneer daar aanleiding voor is. Zo weet u wanneer extra aandacht nodig is, zonder voortdurend mee te kijken. *(unchanged)*
- Retitled from a question that just rephrased the quote into an actual short label, structurally
  closing the same gap #2/#5 had, on a card the brief didn't flag but the same pattern applies to.

### Card 4 — Langer Thuis (kept, quote re-cast) — persona: partner
- **Title (`category`):** Ik voel me verantwoordelijk *(unchanged — already a clean theme label)*
- **Quote (`question`):** ~~"Als mijn vader de telefoon niet opneemt, schrik ik meteen."~~ → **"Als mijn partner de telefoon niet opneemt, schrik ik meteen."**
- **Answer:** ~~Dat gevoel herkennen veel mantelzorgers.~~ → **Dat gevoel is herkenbaar.** Alleen wanneer er écht iets afwijkt, ontvangt u een melding.
- Persona swapped from "volwassen kind over vader" to a partner, per the brief's ask to vary who's
  speaking; "veel mantelzorgers" dropped from the answer since it no longer fits a partner
  scenario as neatly.

### Card 5 — Mijn Thuis (new) — general home security, not eldercare
- **Title (`category`):** Ook beschermd tijdens vakantie
- **Quote (`question`):** "Wat als er wordt ingebroken terwijl wij op vakantie zijn?"
- **Answer:** Onze meldkamer ontvangt het alarm en onderneemt direct actie: wij proberen u en uw contactpersonen te bereiken, en indien nodig schakelt de meldkamer direct de hulpdiensten in — ook wanneer u zelf niet bereikbaar bent.
- Suggested `internal_name`: "Mijn Thuis — inbraak tijdens vakantie"
- Uses the corrected 2026-09-11 phrasing ("meldkamer schakelt direct de hulpdiensten in") verbatim
  — same wording already used in the drafted Mijn Thuis entry in
  [docs/robi-feedback-content-2026-09-11-notes.md](robi-feedback-content-2026-09-11-notes.md), for
  consistency across both docs. Explicitly does **not** say "directe lijn met 112."

### Card 6 — Langer Thuis (kept, quote re-cast) — persona: volwassen kind (over vader, for variety against Card 1's moeder)
- **Title (`category`):** ~~Ze wil absoluut niet verhuizen~~ → **Zelfstandig blijven wonen**
- **Quote (`question`):** ~~"Mijn moeder wil het liefst zo lang mogelijk zelfstandig blijven wonen."~~ → **"Mijn vader wil het liefst zo lang mogelijk zelfstandig blijven wonen."**
- **Answer:** Precies daarvoor is Langer Thuis ontwikkeld. Zelfstandig wonen, met een extra oogje in het zeil wanneer dat nodig is. *(unchanged — already gender-neutral)*
- Title de-gendered (was "Ze") and switched from a restated-preference title to a theme label;
  quote's subject swapped from moeder → vader so cards 1 and 6 aren't both "over moeder."

## Result: persona + package spread

| # | Package | Persona |
|---|---|---|
| 1 | Langer Thuis | volwassen kind (over moeder) |
| 2 | Mijn Thuis | — |
| 3 | Langer Thuis | mantelzorger (generic) |
| 4 | Langer Thuis | partner |
| 5 | Mijn Thuis | — |
| 6 | Langer Thuis | volwassen kind (over vader) |

4/6 Langer Thuis (~67%, closest whole-card split to the requested ~70/30 with 6 cards),
2/6 Mijn Thuis (~33%), no single persona or family member repeated identically.

## Copy-convention check

- u-vorm: "u"/"uw" used correctly throughout (no stray "je/jouw"); no place where "u" was needed
  but "uw" was substituted.
- wifi: not mentioned in any of these 6 cards — n/a.
- No Odoo/Shopify/internal names anywhere.
- No camera/microphone claims for Langer Thuis (card 2's "geen camera's of microfoons" line is
  unchanged from the live original). Card 2 (Mijn Thuis) also states no camera's/microfoons per
  this task's explicit instruction.
- Card 5 uses "schakelt de meldkamer direct de hulpdiensten in," not "directe lijn met 112."
- No phone number was needed in any of the 6 cards, so `088 122 11 11` isn't referenced —
  flagging that it was considered, not missed.

## Open items for Thijs before Step 5 (implementation)

1. **This is Admin-only, no PR needed for the actual content change** — same as the
   2026-09-11 FAQ notes. Step 5, if scoped, would be an Admin metaobject edit checklist (which
   fields to change on which of the 6 entries), not a code change to `sections/faq.liquid`.
2. Check the **3 inactive `faq_item` entries** in Admin before implementing — one or more may
   already be a near-duplicate of the new Card 2 / Card 5 drafts above (the 2026-09-11 notes doc
   drafted a very similar Mijn Thuis "op vakantie" entry already; worth diffing against it rather
   than creating a second, slightly different one).
3. Card 4 and Card 6's quote changes (vader→partner, moeder→vader) are content judgment calls,
   not verified against real customer language — same caveat the 2026-09-11 notes gave its own
   drafted entries. Worth a quick read-aloud check before publishing.
