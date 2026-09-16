# FAQ content — klantenservice consolidation (2026-09-09)

Source documents: "Zo Veilig: Veelgestelde vragen" (general customer-service FAQ, ten
categories, v1.0, laatst bijgewerkt augustus 2026) and "Klant_FAQ.docx" ("Langer Thuis"
klant-FAQ, 14 Q&As, four categories). Both client-provided, already-approved copy —
reproduced word for word, not paraphrased.

## What was already in place

The general FAQ ("Document A", ten categories) was **already live** in
`templates/page.klantenservice.json` (blocks `faq1`–`faq48`) before this task — added
directly via the theme editor on 2026-08-17 (commit `b3672db`, author veronica1nvest), not
by a Claude Code session. All ten categories and all 48 questions matched the source
document, including both of the known gaps below being handled correctly already (see
"Known gaps"). Nothing needed to be added there.

## What this pass changed

1. **Fixed the four PDF links + one policy link that pointed at the wrong place.**
   `faq19`, `faq39`, `faq40`, `faq44`, `faq48` all linked to the internal placeholder
   `/pages/klantenservice#contact` instead of the real files. Restored to the URLs given in
   the source document:
   - Batterijen vervangen: `https://zoveilig.nl/wp-content/uploads/2018/05/Batterijen-vervangen.pdf`
   - Bankrekening wijzigen: `https://www.zoveilig.nl/wp-content/uploads/2017/05/Bankrekening-wijzigingsformulier.pdf`
   - Algemene voorwaarden: `https://zoveilig.nl/algemene-voorwaarden/`
   - Overnameformulier: `https://www.zoveilig.nl/wp-content/uploads/2017/11/Zo-Veilig-Overnameformulier_digitaal.pdf`
   - Herroepingsformulier: `https://zoveilig.nl/wp-content/uploads/2018/05/Herroepingsformulier-5-jaar-002.pdf`

   **These all point at the current production domain (`zoveilig.nl` / `www.zoveilig.nl`),
   not this dev theme.** That's what the source document specifies and they were not
   rehosted — but confirm before this goes live that linking straight to the existing
   production site from the new theme is intended.

2. **Added the "Langer Thuis" klant-FAQ (Document B) as an 11th category** on the same
   `/pages/klantenservice` page (blocks `faqlt-note` + `faqlt1`–`faqlt14`), rather than a
   separate page or a second FAQ hub. A new `note` block type was added to
   `sections/klantenservice.liquid` to carry the required intro disclaimer ("Langer Thuis is
   een hulpmiddel... Bij twijfel... belt u altijd zelf een (huis)arts of 112.") as a
   non-collapsible card at the top of that category, reusing the existing category filter/
   search plumbing.

3. **Retired `/pages/veelgestelde-vragen` as a live entry point.** That page
   (`sections/veelgestelde-vragen.liquid`) turned out to be a *second*, hardcoded FAQ page —
   not editable via theme blocks — linked from the footer and the 404 page, including a
   fake 3-question "Langer Thuis" category with content that doesn't match either source
   document. Per the explicit instruction not to create/leave two competing FAQ entry
   points, the `zv-route` "faq" key (`snippets/zv-route.liquid`) now points to
   `/pages/klantenservice#veelgestelde-vragen` instead. The `veelgestelde-vragen` section and
   template files were left in place (not deleted) but are no longer linked from anywhere in
   the theme.

   **Follow-up needed outside this repo:** if the Shopify admin's main or footer navigation
   menu links to `/pages/veelgestelde-vragen` directly (menu links live in Shopify admin, not
   in this repo), those need to be repointed to `/pages/klantenservice` by hand.

4. **Expanded the "Direct contact" cards** on `/pages/klantenservice` from two (Bellen,
   Mailen) to four, adding Storingen (24/7) and Meldkamer Securitas, plus a postal-address
   line — this is the same "Direct contact" block Document A itself presents as the
   canonical contact info (phone 088 122 11 11, storingen@zoveilig.nl, Meldkamer Securitas
   040 289 41 41, klantenservice@zoveilig.nl, Xenonstraat 60, 1362 GG Almere, ma t/m do
   8:30–17:00 uur, vr 8:30–13:00 uur). All four values are theme settings with those exact
   defaults.

## Known gaps in Document A — not filled in, by design

1. The table of contents lists a final entry, "Bijlage: aandachtspunten voor de
   webredactie" (page 25), but the source document does not actually contain that section —
   it cuts off after the herroepingsrecht content in category 10. **No stand-in appendix was
   written.** Chase the missing page(s) from whoever supplied the source .docx.
2. In category 9, the table of contents lists "Ik wil mijn contract verlengen of overstappen
   naar een Smart Home-systeem", but the body text never has that heading — instead it has
   "Ik wil korting op mijn huidige abonnement" (not in the table of contents at all). The
   body text was used as source of truth (already reflected correctly in `faq42`); the
   Smart Home-systeem content may simply be missing from the source document.

## Not touched

The opening-hours phrasing "ma t/m do 8:30–17:00 uur, vr 8:30–13:00 uur" from Document A's
header matches the phrasing already used on this page (`phone_hours` setting) — no drift to
fix there. Other occurrences of opening hours elsewhere in the theme were not audited or
changed as part of this pass; if any other variant exists, Document A is the canonical
source to reconcile against.
