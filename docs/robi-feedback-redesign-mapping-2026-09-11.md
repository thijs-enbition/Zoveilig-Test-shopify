# Card-grid redesign — functional mapping (2026-09-11)

Pre-implementation inventory of what the current three per-card accordions, the
"Meer informatie" trigger, and the "In winkelwagen" button on `sections/oplossingen.liquid`
(Langer Thuis pricing cards) actually drive, before relocating them into a single
"Wat zit erin?" panel per the confirmed card-grid mockup.

**Decision (asked, confirmed 2026-09-11):** "Meer informatie" and its detail modal are
**kept as a separate, untouched feature**, not merged into "Wat zit erin?". "Wat zit erin?"
is a *new* panel that only consolidates the three accordions below — same inputs, same
handlers, relocated. This was a genuine fork (the mockup lists "Wat zit erin?" but never
mentions "Meer informatie" at all) and needed a decision rather than a guess, since the
alternative reading would have required rewriting the modal's own add-to-cart logic to also
collect uitbreidingen/abonnementen, or dropping the hardware-spec breakout feature entirely.

## 1. "Woning groter dan 100 m²?" (`sections/oplossingen.liquid:170-173`)

A single `<details class="pcard__plus">` with one checkbox, `+€4/mnd`, only rendered when
`price_known` is true (line 169).

- **Price calc**: `recomputeCardPrice()` (`:832-844`) adds the checkbox's `+€…` amount
  (parsed from `.pcard__plus-pr` text via `euroToCents()`) to `card.dataset.priceCents` and
  live-updates `.pcard__price .amt`. Purely a display recompute — the checkout price is
  still whatever `/cart/add.js` returns for the base variant; the surcharge only ever
  travels as a line-item **property**, never a separate price.
- **Cart line-item property**: `readCardOptions()` (`:1101-1117`) recognizes this accordion
  by its summary text starting with "woning" and sets `out.woning =
  'Groter dan 100 m² (+€4/mnd per etage)'`. The card's "In winkelwagen" handler (`:1144`)
  writes this into `props['Woning']` on add. **Note**: this literal string is duplicated —
  the cart-drawer's own per-line Woning toggle (`cartRowHtml`/the change handler at `:1078-1089`)
  sets `props['Woning'] = 'Groter dan 100 m²'` (no surcharge suffix) — a pre-existing minor
  copy inconsistency between the two Woning toggles, not something this task touches.
- **GTM event payload**: any checkbox toggle inside `.pcard__plus-opt` fires
  `package_option_select` (`:1120-1129`) with `{ solution, package, option: <checkbox label
  text>, selected }`. It also writes `data-selected-term`/`data-selected-addon` onto the
  card's `[data-zv-add]` button (write-only from this repo's own JS — presumably read by a
  GTM DOM-element variable at click time; nothing in-repo re-reads these attributes).
- **Relocation**: clean. Keeping the same `.pcard__plus-opt` input/label markup (even if the
  three `<details>` wrappers become one panel) preserves every selector above (`.pcard__plus`,
  `.pcard__plus-opt input`) with no JS changes needed, as long as the checkbox stays inside
  the same `.pcard` container the delegated handlers already scope to.

## 2. "Uitbreidingen toevoegen" (`sections/oplossingen.liquid:174-181`)

Content is theme-editor configurable per solution block: `b.settings.uitbreidingen`, a
textarea of `Naam` or `Naam|Prijs` lines (schema at `:1491`). Today's configured values
(`templates/page.oplossingen.json`):
- Langer Thuis block: `Huisdier-upgrade`, `Extra sensoren`, `Extra toegangspunten`
- Mijn Thuis block: `Extra sensoren`, `Extra toegangspunten`, `Camera-uitbreiding`

All render with no `|Prijs` given today, so every option shows **"Prijs volgt"** (never a
literal amount — provisional by design, per the comment at `:148` and CI check #9).

- **Price calc**: none — these never carry a `+€` amount today, so `recomputeCardPrice()`'s
  `/\+/.test(...)` guard skips them; they don't affect the live price.
- **Cart line-item property**: `readCardOptions()` puts any checked option whose accordion
  summary is *not* "woning…" and *not* "abonnement…" into `out.addons[]`. The add-to-cart
  handler (`:1146`) joins these into `props['Uitbreidingen']` (comma-separated) if any are
  checked.
- **GTM event payload**: same `package_option_select` path as above.
- **Relocation**: clean, same reasoning as item 1.

## 3. "Abonnementen" — Domotica, Ontzorgpakket (`sections/oplossingen.liquid:182-186`)

Two hardcoded checkboxes (not theme-editor configurable, unlike Uitbreidingen), both
labelled "Prijs volgt" unconditionally.

- **Price calc**: none (no `+€` text, same as above).
- **Cart line-item property**: `readCardOptions()` recognizes this accordion by its summary
  starting with "abonnement" and pushes checked names into `out.terms[]`; the add-to-cart
  handler joins them into `props['Abonnement']` (`:1145`).
- **GTM event payload**: same `package_option_select` path.
- **Relocation**: clean, same reasoning as item 1.

## 4. "Meer informatie" (`sections/oplossingen.liquid:206`, modal at `:1150-1347`)

A `<button data-zv-detail data-finder-key="…" data-product-url="…">` — **not** an `<a>`, so
there is no true no-JS fallback despite the top-of-file comment claiming one (`:20`); without
JS the button does nothing. Click opens the accessible breakout modal (`openModal()`,
`:1275-1294`), rendering package/hardware content from the `#opl-modal-data` JSON island
(`:361-389`, keyed by `finder_key`): full component list with specs, "Ideaal voor" /
"Typische opstelling", and — when there are sibling packages in the same panel — tabs to
switch between them (`pbd-switch`, `:1226-1233`).

The modal has its **own independent** add-to-cart path, entirely separate from the card's:
`data-pb-add`/`data-pb-buy` buttons (`:1243-1244`) build `props` from only `Pakket/SKU/
Oplossing/Platform/Bron` plus its own `Woning` flag, sourced from the modal's own
`data-pb-plus` checkbox (`:1238-1240`) — which is **not synced** with the card's own
Woning checkbox (checking one has no effect on the other's state). This is a pre-existing
inconsistency, not introduced by this task.

- **Relocation**: per the confirmed decision above, **out of scope** — left exactly as is.
  The new card grid keeps its own "Meer informatie" trigger (button, same `data-zv-detail`
  attributes) alongside the new "Wat zit erin?" panel; the modal's markup/JS is untouched.

## 5. "In winkelwagen" (`sections/oplossingen.liquid:208`, handler `:1131-1148`)

`<button data-zv-add data-variant="{{ v.id }}" data-selected-term="" data-selected-addon="">`.
Only rendered when `price_known and v.available` (`:207`).

On click (`:1132-1148`):
1. `readCardOptions(card)` re-derives `{ woning, terms[], addons[] }` fresh from whatever's
   currently checked in the card (not from the `data-selected-*` attributes — those are
   write-only, see item 1).
2. Builds `props = { Pakket, SKU, Oplossing, Bron: 'Oplossingen' }`, then conditionally adds
   `Woning` / `Abonnement` / `Uitbreidingen` if any are set.
3. Calls the shared `addToCart(d.variantId, props, 'drawer', btn)` (`:915-953`), which:
   - Resolves whether the universal activation-fee variant needs adding (dedup against the
     live cart, `activationLineToAdd()`, `:907-913`) and POSTs both lines in one
     `/cart/add.js` call.
   - Fires the GA4-shaped `ZV.addToCart(...)` analytics call (`:935`) — **this is the exact
     call site already flagged in `docs/analytics-tracking-status-2026-09-11.md` as using the
     live `/cart/add.js` response price instead of the confirmed static
     `zv_<pkg>_monthly` value.** The new CTA reuses this same `addToCart()` function
     unchanged, so it inherits the same pre-existing bug — **not fixed here, and not made
     worse**: the new CTA passes the same shape of `properties` object as today, just from a
     relocated button.
   - On success, opens the cart confirmation drawer (`openCart()`) — unaffected by layout.

- **Relocation**: clean. The new CTA button just needs to keep `data-zv-add`,
  `data-variant`, and the same `data-*` GTM hooks (`data-zv-event="add_to_cart"`,
  `data-solution-type`, `data-solution-name`, `data-package-sku`, `data-cta-name`,
  `data-cta-position`), and stay inside the same `.pcard` container as the relocated
  accordion checkboxes so the delegated `change`/`click` handlers keep finding it via
  `closest('.pcard')` / `card.querySelector('[data-zv-add]')`.

## Addendum — concurrent branch work landed mid-task

While this mapping was being written, a **separate, concurrent session was actively
committing to `fix/robi-feedback-content-2026-09-11` in the same working directory**
(discovered via `git status`/`git reflog` showing commits appear in real time). Three
commits landed there during this task: `31bbbed` (112/meldkamer wording), `aac146c`
("Langer Thuis: looptijd on cards, uitbreidingsregel wording, jargon cleanup"), and
`a485913` ("Price notation: standardize on /mnd, sync jargon in pricing config"). These
are exactly the "already fixed in the previous branch" premises this task's brief referred
to — they weren't false, they simply hadn't landed yet at the moment this task started.

To avoid the two sessions colliding on the same file in the same physical checkout (asked,
confirmed 2026-09-11), this task's work was moved into an isolated git worktree
(`.claude/worktrees/redesign-2026-09-11`) on `fix/robi-feedback-redesign-2026-09-11`,
rebased onto the finished tip of `fix/robi-feedback-content-2026-09-11` (`a485913`). All
line numbers and quoted strings above were re-verified against that tip.

**One consequence worth flagging:** `aac146c` renamed the "Abonnementen" accordion summary
to "Extra diensten (optioneel)" but didn't update `readCardOptions()` in
`sections/oplossingen.liquid`, which classifies that group by sniffing whether the
`<summary>` text starts with the literal word "abonnement" (`label.indexOf('abonnement')
=== 0`). "Extra diensten (optioneel)" no longer matches, so as of `a485913` this group
silently misfiles into `out.addons[]` instead of `out.terms[]` — a Domotica/Ontzorgpakket
selection now lands in the cart line's `Uitbreidingen` property instead of `Abonnement`.
This is a regression from the concurrent branch, not from this task. It is not being fixed
as a separate patch here; the relocation into "Wat zit erin?" (below) replaces the whole
text-sniffing mechanism with an explicit `data-group` attribute per option group, which
fixes this as a natural side effect of the planned refactor, not as bonus scope.

## Conclusion

Everything maps cleanly onto "same inputs/handlers, just relocated into one 'Wat zit
erin?' panel" — proceeding directly to Step 2 implementation in this run, per the task's own
instruction. The only genuine fork (Meer informatie's fate) was resolved by asking rather
than guessing, since both silently dropping a working feature and silently expanding this
task's scope into the modal's own add-to-cart logic were the wrong kind of call to make
unilaterally.

The redesign's CTA button *does* call into the same `addToCart()` / `ZV.addToCart(...)` code
path that carries the pre-existing analytics price bug (`sections/oplossingen.liquid:935`,
documented in `docs/analytics-tracking-status-2026-09-11.md`). It is reused as-is; this task
does not touch or fix that bug.
