# Mijn Thuis pakket-matcher — scenario/scoring draft (2026-09-15)

Research + content draft only. No `.liquid`/`.js`/`.css` file touched — see **Step 3** at
the bottom for the explicit confirmation. Nothing here is scoped or approved for build.

**Note on prior work:** a same-shaped research doc
(`docs/mijn-thuis-pakket-matcher-research-2026-09-14.md`) was written 2026-09-14 but was
left **uncommitted** in an orphaned worktree (`zv-mijnthuis-matcher-research`, branch
`docs/mijn-thuis-pakket-matcher-research-2026-09-14`) — never pushed, invisible to git
history or to this session until stumbled on directly. Its technical findings (line
numbers, tier data, finder keys) were re-verified against current `origin/main` while
writing this doc and are still accurate — `snippets/zv-pakket-matcher.liquid` and
`assets/zv-vergelijk-pakketten.js` have not changed since. This doc reuses and updates
that analysis rather than re-deriving it from scratch; it should probably be committed
too (as a superseded/historical doc) so it isn't lost a second time — flagging, not doing
it here since it's out of this branch's scope.

**Also note:** `feature/mijn-thuis-vergelijk-pakketten-2026-09-15` merged today (PR #37) —
static, non-interactive Mijn Thuis scenario tiles + a plain Alert/Protect/Vista
comparison table on `/pages/vergelijk-pakketten`, built deliberately *outside* this
matcher (see that section's own header comment). It is **not** scoring content and
doesn't answer any question in this doc, but its 7 tiles' wording is reused/adapted below
where it fits a package-weighted scenario, per the brief. It also shipped a relevant piece
of infrastructure this doc leans on in §3: `sections/oplossingen.liquid`'s tab deep-link
hash handling now recognizes a `#mijn-thuis-vista` suffix that both selects the Mijn Thuis
panel and scrolls to/focuses Vista's existing lead form (`[data-vista-form]`) —
`applyHash()`/`focusVista()`, oplossingen.liquid:1059-1077.

---

## Step 1 — How Langer Thuis's scoring actually works

Read in full: `snippets/zv-pakket-matcher.liquid` (172 lines) and
`assets/zv-vergelijk-pakketten.js` (233 lines). Both are the **single shared
implementation** for the Langer Thuis matcher, rendered from two call sites
(`sections/vergelijk-pakketten.liquid` standalone, and embedded under the Langer Thuis
cards in `sections/oplossingen.liquid`).

**Data shape a scenario needs** — a `scenario`-type section block, three settings:
- `title` (text) — the bold headline (`.pm-card__t`).
- `quote` (text) — the italic example line (`.pm-card__q`), optional.
- `package` (select: inzicht/zeker/beschermd, default `zeker`) — **exactly one** package
  per card. There is no multi-package weighting, no partial credit, no numeric weight
  setting — a card counts as one full point for one package, or it isn't scored at all.
- `row` (select: 1/2/3, default `1`) — purely a layout grouping (three `.pm-row` flex
  containers); it has no effect on scoring. A row with zero cards for it is simply not
  rendered (`zv-pakket-matcher.liquid:89-103`), so row-balance isn't structurally required.

At render, each card becomes `<button data-pm-card data-pm-pkg="{{ package }}">` — the
package mapping lives in a **DOM data attribute**, not a JS config object. This matters
for generalizing later (§4): the scoring JS never hardcodes which packages exist except
for two small exceptions noted below.

**Scoring algorithm** (`assets/zv-vergelijk-pakketten.js:41-56`, `recommend()`):
1. On every card click, toggle `aria-pressed` true/false (a card is a toggle, not a
   single-select radio — the visitor can select any number of cards across any rows).
2. `score = { inzicht: 0, zeker: 0, beschermd: 0 }`. For every card currently pressed,
   `score[card's package] += 1`.
3. If nothing is pressed, no recommendation (`recommend()` returns `null`) — advice bar
   stays hidden, nothing on the table is highlighted.
4. Otherwise, the package with the **highest score wins**. Ties are broken by
   `TIER[p] > TIER[best]`, where `TIER = { inzicht: 1, zeker: 2, beschermd: 3 }` — i.e.
   **the higher (more protective/expensive) tier wins a tie**, not the first-clicked or a
   fixed default.
5. Re-scored on every click (not just once) — the recommendation can change as the
   visitor selects/deselects cards.

**Rendering the result** (`render()`, lines 75-95):
- The winning package's column gets `.is-match` on every `[data-pm-pkg]` cell in the
  table (header + all body cells), which is a pure CSS highlight — no content changes in
  the table itself.
- The advice bar (`.pm-advies`, hidden by default) is revealed, its name filled from a
  hardcoded `NAMES` map (`{ inzicht: 'Inzicht', zeker: 'Zeker', beschermd: 'Beschermd' }`)
  and its tagline **read live from the table's own "Meest geschikt voor" row**
  (`taglineFor()` reads `[data-pm-tagline-for="pkg"]`'s text content) — this is why the
  advice bar and the table row can't drift out of sync: one is the source, the other reads
  it.
- A visually-hidden `aria-live="polite"` status region announces "Ons advies: X. <tagline>"
  for screen readers.

**"Kies X" → cart, in detail** (`addPackageToCart()`, lines 127-175):
- Package → real product resolution happens **once, server-side, at Liquid render time**,
  not in JS: `zv-pakket-matcher.liquid:56-76` loops the resolved collection's products,
  reads each one's `custom.finder_key` metafield, maps it through a `case` block
  (`aware`→`inzicht`, `aware_plus`→`zeker`, `care`→`beschermd`) and emits a
  `<script type="application/json" data-pm-products>` blob keyed by package id:
  `{variantId, sku, name, line, available, url}`. The JS only ever reads this blob
  (`products[pkg]`) — it never resolves a product itself and has no variant ids inlined.
- On "Kies X" / the advice bar's add button: fetch the live cart, check whether that
  variant is already a line (bump quantity via `/cart/change.js` if so, matching Shopify's
  own merge-on-repeat-add behaviour), otherwise `/cart/add.js` a new line carrying
  `Pakket`/`SKU`/`Oplossing`/`Bron` line-item properties. Separately, dedupe-checks the
  universal activation-fee variant (`data-activation-variant-id`, resolved from
  `zv_activation_handle` at Liquid render time) and appends it to the same add if it's not
  already in cart.
- Two call sites for this, same function, different `ctaLocation`/`bron` values: the
  advice bar's own button (`vergelijk_pakketten` / `Vergelijk pakketten`) and, only when
  `embedded: true` (i.e. only on the Oplossingen page's own embed — the standalone
  Vergelijk-pakketten page instead renders plain `<a href="{{ opl }}">` links here, per
  the snippet's own `embedded` param doc), the comparison table's own "Kies …" buttons
  (`oplossingen_vergelijk_tabel` / `Oplossingen`).
- Success/failure UI (label swap to "Toegevoegd ✓", disabled/aria-busy state, inline error
  text, `refreshCart()` firing `cart:refresh`/`zv:cart:added` events for the rest of the
  page's cart UI to pick up) is identical for every package — nothing here is
  package-specific beyond which variant id gets fetched from the products blob.

**Where exactly-3-scored-outcomes-with-a-fixed-cart-end-state is baked in** (answers Step
1.2):
1. `assets/zv-vergelijk-pakketten.js:7-8` — `TIER` and `NAMES` are **object literals with
   3 hardcoded keys** (`inzicht`/`zeker`/`beschermd`). Nothing generic reads these from
   the DOM; a 4th or differently-named package id would silently fail `TIER[p] >
   TIER[best]` (`undefined > undefined` is `false`) and get no display name.
2. `assets/zv-vergelijk-pakketten.js:42` — the `score` accumulator object is initialized
   with the same 3 literal keys; a card whose `data-pm-pkg` isn't one of them scores
   nothing (`score.hasOwnProperty(p)` guards silently, no error).
3. `snippets/zv-pakket-matcher.liquid:45` — `pkgs = 'inzicht,zeker,beschermd' | split: ','`,
   used only to map the feature-table's `y|n` row string positions 2/3/4 to a package id
   by array index. Adding/renaming a package means editing this list *and* every row's
   fixed 3-value shape.
4. `snippets/zv-pakket-matcher.liquid:63-67` — the `finder_key` → package-id `case` block
   is a literal 3-branch case, one per Langer Thuis SKU.
5. **The cart end state is uniform across all 3** — every package resolves to a real
   purchasable variant and the same `addPackageToCart()` path. There is **no branch
   anywhere in this file or the JS for a package that isn't purchasable** — no
   `purchasable` flag in the products JSON, no lead-form path, nothing. This is the
   precise gap Vista falls into (§3): the mechanism has no concept of "recommend this, but
   don't try to add it to cart."

## Step 1.3 — Mijn Thuis finder keys, confirmed

Per `CLAUDE.md`'s "Product data (confirmed from the real store, 2026-09-09)" table and
re-confirmed directly against `sections/oplossingen.liquid`'s `#opl-modal-data` JSON today
(`oplossingen.liquid:553-555`, byte-identical to what the 2026-09-14 draft recorded — this
data hasn't moved):

| Product | `custom.finder_key` | SKU | tier (from `#opl-modal-data`) |
|---|---|---|---|
| Mijn Thuis Alert | `secure` | MT-ALE | `alarmpod`, `senseplug`, `pir`, `deursensor`, `codepaneel` |
| Mijn Thuis Protect | `guard` | MT-PRO | `hub`, `codepaneel`, `rook`, `pir`, `deursensor`, `meldkamer` |
| Mijn Thuis Vista | `secure_plus` | MT-VIS | `alarmhub`, `cam_in`, `cam_out`, `deurbel2`, `meldkamer` |

All three share `product.type == "Beveiligingsabonnement"`, same subscription-detection
signal as Langer Thuis — no new lookup mechanism needed.

**Is the snippet hardcoded to Langer Thuis's finder keys specifically, or just to "3
keys"?** The latter. Nothing in `zv-pakket-matcher.liquid` or the JS contains the literal
strings `aware`/`aware_plus`/`care` outside the one `case` block at lines 63-67 — that
block is trivially re-pointable to `secure`/`guard`/`secure_plus`. The deeper coupling is
always to **the 3 *internal* ids** (`inzicht`/`zeker`/`beschermd` as variable names, CSS
data attributes, and object keys), not to Langer Thuis's specific vocabulary — see §4.

`snippets/zv-pricing.liquid` already emits Mijn Thuis's monthly variables in the exact
shape the matcher currently consumes for Langer Thuis (`zv_alert_monthly`,
`zv_alert_monthly_cents`, `zv_protect_monthly`, etc.), plus `zv_vista_monthly = 'Op maat'`
and `zv_vista_cta = 'Vraag persoonlijk advies'` — confirmed still present, unchanged.

---

## Step 2.1 — Draft scenario tiles (9 cards, 3 rows, mirroring Langer Thuis's shape exactly)

Langer Thuis actually ships **9** scenario blocks across 3 rows (`zv-pakket-matcher.liquid`
header comment, line 14: "the 9 scenario blocks"), not 7 — flagging this since the brief
said "aim for similar count to Langer Thuis's 7"; 7 is the tile count from the *unrelated*
static, non-scored build (PR #37), not the interactive matcher's own shape. Since this doc
is specifically about replicating the **scoring** mechanism, the draft below matches the
matcher's real 9-card/3-row/one-package-each shape instead — 3 cards per package, so each
of Alert/Protect/Vista has an equal chance to win a tie-free score. If a smaller set is
preferred, the JS makes no assumption about row balance (§ Step 1), so it can be trimmed
later without touching code.

Each row is weighted to one package, same convention as Langer Thuis's own preset (which
groups scenarios by intended package rather than strictly by narrative order).

| Row | Title | Quote | Package | Provenance |
|---|---|---|---|---|
| 1 | Weet dat uw huis beveiligd is | *"Voor u vertrekt, schakelt u met één tik het systeem in."* | Alert | **Reused verbatim** from PR #37's static tile 1 (`sections/vergelijk-pakketten.liquid`). Matches Alert's own hook, "Slim alarm dat u zelf in de gaten houdt," and its `codepaneel` tier item (self arm/disarm). |
| 1 | Waarschuwing bij een open deur of raam | *"Achterdeur staat open terwijl het systeem is ingeschakeld."* | Alert | **Reused verbatim** from PR #37's tile 3. `deursensor` is in Alert's tier. |
| 1 | Zie direct wat er gebeurt | *"02:14, bewegingsmelder in de gang geactiveerd."* | Alert | **Reused verbatim** from PR #37's tile 2, deliberately kept in Alert's row (not Protect's) — framed as *you* noticing, not the meldkamer, matching Alert's "geen meldkamer" positioning. `pir` is in Alert's tier. |
| 2 | Meldkamer grijpt in wanneer het nodig is | *"Alarm niet binnen 30 seconden uitgezet, de meldkamer belt direct."* | Protect | **Reused verbatim** from PR #37's tile 5. `meldkamer` is in Protect's tier (and Alert's is not). |
| 2 | Rook op tijd ontdekt | *"03:40 rookmelder gaat af, de meldkamer schakelt direct de hulpdiensten in."* | Protect | **Reused verbatim** from PR #37's tile 4. `rook` is in Protect's tier only — absent from both Alert's and Vista's, making this an unambiguous Protect-only signal. |
| 2 | Directe opvolging bij een mogelijke inbraak | *"02:47, bewegingsmelder afgegaan — de meldkamer neemt meteen contact op."* | Protect | **Adapted** from the recovered 2026-09-14 draft, itself adapted from Langer Thuis's shipped "Snelle hulp als iedere seconde telt" card. Distinguishes from Row 1's Alert motion-sensor card by naming the meldkamer's follow-up explicitly (`pir` + `meldkamer` both in Protect's tier). |
| 3 | Camera als extra zekerheid | *"Bekijk live beelden van uw voordeur, optioneel toe te voegen."* | Vista | **Reused verbatim** from PR #37's tile 6. `cam_in`/`cam_out` are Vista-only tier items. |
| 3 | Zie direct wie er voor de deur staat | *"Gemiste beltoon? De videodeurbel toont wie er om 15:20 aanbelde."* | Vista | **Adapted** from the recovered 2026-09-14 draft, sourced from the `deurbel2` (Videodeurbel) component's own tagline ("Zie en spreek wie er aanbelt, waar u ook bent"). `deurbel2` is Vista-only. |
| 3 | Volledig zicht op huis en erf | *"Buitencamera legt vast wie er om 23:40 rond het huis liep."* | Vista | **Adapted** from the recovered 2026-09-14 draft, sourced from `cam_out`'s tagline. |

**Left out, flagged rather than force-fit:** PR #37's remaining tile, "Altijd te bereiken,
ook onderweg" (app arm/disarm from anywhere) — app control isn't represented as a distinct
tier item for any of the three packages (`codepaneel` covers on-site arm/disarm only), so
there's no tier-data basis to weight it toward one package over another the way every card
above has. Either drop it, or resolve it with a product answer first (does app control
actually differ between Alert/Protect/Vista, or is it identical across all three and
therefore useless as a *distinguishing* scenario for scoring purposes?).

**Tie-break implication:** with `TIER = { alert: 1, protect: 2, vista: 3 }` (proposed,
mirroring Langer Thuis's ascending-protection-level convention exactly), a visitor who
selects one card from each row ties 1-1-1 and the result would resolve to **Vista** — which
immediately collides with the Vista problem in §3below, since Vista is the one package this
mechanism can't just "add to cart." This isn't a hypothetical edge case; a visitor
sampling one card per row is a plausible real usage pattern, so whichever Vista resolution
option is chosen in §3 needs to handle being reached this way, not just via "recommend Vista
by a clean majority."

## Step 2.2 — The Vista problem: three options, not decided

Per Step 1's finding: nothing in the shared mechanism has a concept of "recommend this
package, but its outcome isn't add-to-cart." Vista is `purchasable: false` in
`pricing.config.json` (`monthlyRecurringPrice.status: "CUSTOM_ADVIES"`) and, on
Oplossingen's own card grid, renders an entirely separate branch: a lead-callback form
(`pcard__vista`, `oplossingen.liquid:349-361`) posting to `window.ZV_LEAD_ENDPOINT`
(Odoo CRM) — no "Meer informatie" drawer, no add-to-cart button at all.

**Option A — Port the lead-callback form into the matcher itself.**
Duplicate `pcard__vista`'s form markup/JS into `zv-pakket-matcher.liquid` and
`zv-vergelijk-pakketten.js`, so the matcher's advice bar and table CTA column render the
real lead form in place of an add-to-cart button when the winning/chosen package is Vista.
Correct in that the visitor never leaves the matcher, but duplicates a form (and its
POST/validation/success-state logic) that currently exists in exactly one place, and needs
a `purchasable`/`is_vista` flag threaded through the `data-pm-products` JSON so the JS
knows to branch.

**Option B — Exclude Vista from the add-to-cart outcome; degrade to a generic advice CTA.**
Vista scenario cards still exist and still score normally, but if Vista wins, the advice
bar/table CTA shows a generic "Vraag persoonlijk advies" button (reusing the pattern
already on `vergelijk-pakketten.liquid`'s own `cmp-help` block, lines ~85-92) instead of a
package-specific outcome. Lowest engineering risk (no lead-form duplication, no JSON flag),
but the visitor's specific "you're a Vista fit" context is discarded — they land on a
generic advice touchpoint, not a pre-filled or even Vista-labeled one.

**Option C — Reuse the `#mijn-thuis-vista` deep-link + scroll/focus mechanism PR #37 already
shipped** (new option, not in the 2026-09-14 draft — this infrastructure didn't exist yet
when that draft was written). When Vista wins, render its CTA as a plain link to
`{{ opl }}#mijn-thuis-vista` — `oplossingen.liquid`'s existing `applyHash()`/`focusVista()`
(lines 1059-1077) already selects the Mijn Thuis panel, scrolls to Vista's card, and
focuses its lead form's first input, all client-side, on page load. No new form, no new
JSON flag, no JS branching inside the matcher itself — Vista's column would look and behave
like Alert/Protect's plain-link path already does on the standalone Vergelijk-pakketten
page (i.e. the *embedded* Oplossingen case still needs a decision, since there `embedded:
true` currently renders `<button data-pm-choose>` for everything, not a link — Vista's
button would need to become a link exception in that one spot). Lower cost than Option A,
more specific than Option B (still lands the visitor scrolled-and-focused on Vista's real
form, on the correct page), but ties this matcher's Vista behavior to a piece of
Oplossingen-page JS that lives outside this snippet — a coupling that doesn't exist for any
other part of the matcher today.

No existing precedent picks between these. **Flagging as a decision for Thijs/product**,
not guessed — this doc takes no position beyond laying out the trade-offs.

## Step 2.3 — Fork vs. generalize `zv-pakket-matcher.liquid`: recommendation, not a decision

**What a Mijn Thuis reuse would actually touch**, confirmed against current code (all 5
points from the recovered 2026-09-14 draft still hold, re-verified line-for-line):
1. `pkgs = 'inzicht,zeker,beschermd' | split: ','` (line 45) — hardcoded 3-id list, used
   only for the feature-table row's positional y/n mapping.
2. The `finder_key` → package-id `case` block (lines 63-67) — hardcoded to Langer Thuis's
   3 SKUs.
3. The comparison table's 8-row feature string (line 137) — hardcoded Langer Thuis copy,
   entirely different feature set than Mijn Thuis needs.
4. The `<thead>` — 3 literal `<th data-pm-pkg="…">` cells with tagline defaults baked in as
   named Liquid variables (`tag_inzicht`/`tag_zeker`/`tag_beschermd`), not looped.
5. The CTA row's button labels ("Kies Inzicht" / "Kies Zeker" / "Kies Beschermd") — literal
   text per column.
6. **JS side**: `TIER`/`NAMES` (lines 7-8) and the `score` accumulator (line 42) are all
   hardcoded 3-key objects (see Step 1's "where it's baked in" list, items 1-2).
7. **Vista's own gap** (§2 above) is a 7th consideration that's independent of
   generalize-vs-fork — it exists either way and must be resolved by one of the three
   options regardless of which path is chosen here.

None of this is deep architecture — it's inlined copy/config, not a structural
assumption — but "generalize" touches all 6 points above in a file whose own header
comment already declares it the single source of truth for **two** live call sites
(`vergelijk-pakketten.liquid` and Oplossingen's Langer Thuis embed) plus, if generalized,
a third (a new Mijn Thuis embed) and a fourth if Mijn Thuis also gets a standalone-page
matcher analogous to Langer Thuis's.

**Two paths:**

1. **Generalize.** One template serves both lines via params (package-id list, copy,
   finder_key mapping, feature rows). Correct long-term — avoids a second file to keep in
   sync for any shared fix (styling, a11y, cart-add error handling) — but every change is
   made against code the *live* Langer Thuis matcher depends on; a regression here breaks
   Langer Thuis, not just the new addition. The JS's `TIER`/`NAMES`/`score` objects would
   need to be built from data (e.g. reading package ids off the rendered `data-pm-pkg`
   attributes already in the DOM, which the scoring loop already does structurally at line
   46 — only the *tie-break order* and *display-name* maps are the genuinely hardcoded
   parts). A lower-risk variant: keep **internal** ids generic (`tier1/tier2/tier3`, order
   = ascending protection level, same convention as today) and parameterize only the
   *display* layer (labels/taglines/finder_key mapping) per line — avoids touching the
   JS's tie-break logic at all.
2. **Fork** a `snippets/zv-pakket-matcher-mijn-thuis.liquid`. Zero risk to the existing
   Langer Thuis matcher. `assets/zv-vergelijk-pakketten.js` auto-inits every `[data-pm-root]`
   on the page already (line 228 in the JS, `document.querySelectorAll('[data-pm-root]')`),
   so a fork can likely keep sharing that one JS file as-is — *if* it keeps using the same
   `inzicht/zeker/beschermd`-shaped internal ids. Introducing genuinely new ids
   (`alert`/`protect`/`vista`) would still require reconciling `TIER`/`NAMES`/`score`,
   whether forked or generalized — that part of the cost is unavoidable either way, it's
   only the markup duplication that forking specifically buys you out of touching shared
   code for. Cost: two files to keep in sync for any future shared fix, and the
   "single source of truth" claim in the header comment becomes false for one of the two
   lines it would then no longer describe.

**Recommendation:** generalizing looks tractable, for the same reason the 2026-09-14 draft
gave — the JS already keys most of its logic off DOM attributes rather than literals, and
the "lower-risk variant" above (generic internal ids, display-only params) sidesteps most
of the remaining JS risk. But this is exactly the kind of call this doc is not meant to
settle — it's an implementation-scoping decision for whoever picks up the actual build.
**Hard constraint either path must respect:** `/pages/vergelijk-pakketten` is a third
consumer (not just the two Oplossingen embeds) of whatever changes, and per the current
(merged, PR #37) static content it *already* has a Mijn Thuis section on that page today —
any interactive matcher built for Mijn Thuis would need to either replace or coexist with
that static section, which is itself a product decision this doc surfaces but doesn't
answer.

---

## Open questions for Thijs / product (not guessed at)

1. **Scenario acceptability** (Step 2.1) — particularly the 2 "Adapted" cards with no
   directly-reusable existing copy (the Protect meldkamer-follow-up-on-motion card, the
   Vista videodeurbel card), and whether the dropped "app control" scenario should be
   resolved with real per-package data instead of left out.
2. **Vista's matcher resolution** — Option A, B, or C in §2.2. C is the newest and
   cheapest given what already shipped today, but changes the *kind* of coupling the
   matcher would have (to Oplossingen's own JS) compared to A or B.
3. **Generalize vs. fork** (§2.3) — an implementation-scoping decision, not resolved here.
4. **Does an interactive Mijn Thuis matcher replace or sit alongside** the static
   scenario-tiles + table section PR #37 already shipped on `/pages/vergelijk-pakketten`?
   Building both would put two different "compare Mijn Thuis" UIs on the same page.
5. The orphaned 2026-09-14 draft itself — should it be committed (even as a superseded/
   historical doc) so this doesn't happen a third time? Flagged, not actioned here.

---

## Step 3 — Confirmation

No `.liquid`, `.js`, or `.css` file was modified in this branch. `git status` below shows
only this new doc.
