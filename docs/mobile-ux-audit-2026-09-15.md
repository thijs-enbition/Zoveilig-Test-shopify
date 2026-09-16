# Mobile UX audit — 2026-09-15

**Method: static analysis only.** This pass was done by reading CSS/Liquid source (grep +
manual review across `sections/`, `snippets/`, `assets/*.css`) — there was no browser or
screenshot access in this session, so nothing below has been visually confirmed on a real
phone or emulator. Every row is graded **High** (the code plainly does what's described, low
risk of misreading it), **Medium** (the code supports the claim but the actual visual outcome —
wrapping vs. overflow vs. squeeze — depends on real content/rendering I couldn't observe), or
**Low** (a plausible risk worth a second look, not a confirmed defect). Treat Medium/Low rows as
judgment calls for Thijs, not asserted bugs. Nothing here was fixed — this is a findings doc
only, per the brief for this session.

**Context.** This audit follows `fix/mobile-nav-drawer-2026-09-15` (commit `52f805a`, PR #48),
which fixed one specific bug: the desktop nav (`.sf-links`) disappears below 980px with nothing
put in its place, so the site was unreachable by nav on a phone. That fix added `.sf-drawer`.
This pass looks for the same class of "unreachable/unusable on a phone" issue elsewhere in the
theme, scoped to the custom `zv-*`/theme-specific code (Dawn's own stock sections —
`main-account`, `main-order`, `main-cart-items`, `cart-drawer`, `quick-order-list` — are not
audited here; they're unmodified Dawn and not part of the ZV-specific UI this pass targets).

**Confirmed-fine, not re-checked next time:**
- Viewport meta tag is correct: `<meta name="viewport" content="width=device-width,initial-scale=1">`
  in [layout/theme.liquid:30](layout/theme.liquid#L30).
- Both comparison tables (`sections/vergelijk-pakketten.liquid:154` and
  `snippets/zv-pakket-matcher.liquid:184`, both `<table class="cmp-tbl">`) are wrapped in
  `<div class="tbl-wrap">`, which carries `overflow-x:auto` (`assets/zv-vergelijk-pakketten.css:71`).
  Confirmed both instances actually use the wrapper, not just the CSS rule existing.
- `camera-hardware.liquid`'s dense hardware-spec rows (`.zv-camera .hw`, `.hw-modes`,
  `.stepper`) all collapse to a single column / wrap at `max-width:680px`
  ([camera-hardware.liquid:334](sections/camera-hardware.liquid#L334)), which covers every
  phone width — no overflow risk found in this section despite it being the densest layout in
  the theme.
- The Oplossingen package-card grid (`.pgrid`, [oplossingen.liquid:701](sections/oplossingen.liquid#L701))
  uses `minmax(0, 1fr)` (not a bare fixed track), so it can't blow out a grid container the way
  a plain `1fr` with intrinsic content sometimes does, and it drops to one column at ≤720px.

---

## 1. Tap targets under 44×44px

| File | Line | Issue | Suggested fix | Confidence |
|---|---|---|---|---|
| `assets/zv-chrome.css` | 93–96 | `.sf-iconlink` (search) and `.cart` in the header have no padding — clickable area is the bare 22×22px `.sf-icn` svg. *(Pre-confirmed known finding per the audit brief.)* | Add `padding: 11px` (or similar) to `.sf-iconlink`/`.cart` so the hit area reaches ~44×44px without changing the visible icon size. | High |
| `assets/zv-chrome.css` | 105 | `.sf-burger` (mobile nav drawer trigger) is 40×40px — under the 44px guideline, though closer than the icons above. | Bump to `width:44px;height:44px` (icon itself can stay 22×22 inside via the existing flex centering). | Medium |
| `assets/zv-lio.css` | 41–42 (markup: `snippets/zv-lio.liquid:23`) | `.zv-lio__close` (the Lio popup's × dismiss button) is 26×26px, icon-only, no padding. | Increase to ≥40px, or add invisible padding so the visual size stays small but the hit area grows. | Medium |
| `sections/oplossingen.liquid` | 993 (CSS), 1286 (markup) | `.addcart__rm` — the "×" remove button on an add-on line inside the cart-added drawer — is 26×26px, icon-only (`×` text glyph, no padding). | Increase to ≥40px or add padding. | Medium |
| `sections/oplossingen.liquid` | 979 (CSS), 1315 (markup) | `.addcart__x` — the drawer's close button — is 40×40px. Same "close to but under 44" pattern as `.sf-burger`. | Bump to 44×44px. | Medium |
| `sections/oplossingen.liquid` | 888 (CSS), 1563 (markup) | `.pb-x` — the product-detail panel's close button — is 42×42px. Marginal. | Bump to 44×44px. | Low |
| `sections/camera-hardware.liquid` | 330 | `.stepper button` (the qty +/− steppers on each camera hardware row) is 38×40px. | Increase to ≥44px height/width, or pad on top of the existing border. | Medium |
| `sections/zv-cart.liquid` | 206 (CSS), 98/100 (markup) | `.qty .qbtn` (cart line-item qty +/− — implemented as `<a>` links, not `<button>`) is 34×34px, the smallest of the icon-style controls found. | Increase to ≥44px; also consider whether these should be `<button>`s rather than anchor tags with a `quantity=` querystring (separate concern, not scored here — flagging only the size). | Medium |
| `sections/oplossingen.liquid` | 745 (`.pcard__plus-opt`), similar pattern in `zv-checkout-overview.liquid:458` (`.ovcheck`), `zakelijk.liquid:204` (`.lead .consent`), `oplossingen.liquid:1040`/`1056` (`.cs-check`, `.pcard__vista-consent`) | Every checkbox input itself is 16–19px, but all are wrapped in a `<label>` with adjacent text (confirmed in markup), so the *effective* tap width is much larger than the box alone. The one soft spot: `.pcard__plus-opt`'s padding is asymmetric (`0 2px 12px` — no top padding), giving a label height of roughly 13px text + 12px bottom padding ≈ 28px, still under 44px vertically even though width is fine. | Add symmetric `padding: 8px 2px` (or similar) to bring the label's vertical hit area closer to 44px. Low severity since the label pattern already avoids the worst case (bare 16px checkbox with nothing else clickable). | Low |

## 2. Fixed-width elements that don't respond to viewport width

No confirmed overflow bug was found. The theme is consistent about using `clamp()`/`%`/`vw`/
grid `minmax(0,1fr)` for anything that could plausibly overflow a 375px viewport — including
the densest candidates named in the brief (`zv-vergelijk-pakketten.css`, the Oplossingen
package cards, camera-hardware spec tiles — see "Confirmed-fine" above). One soft spot:

| File | Line | Issue | Suggested fix | Confidence |
|---|---|---|---|---|
| `assets/zv-lio.css` | 20–31 (used by `snippets/zv-lio.liquid`) | `.zv-lio__bubble` has `white-space: nowrap` and no `max-width`, inside a `position:fixed` popup anchored `right:20px` with no left-edge constraint. Message strings are currently short ("Hoi!", "Bekijk dit!", "In de winkelwagen!", "Goede keuze!" — see `snippets/zv-lio.liquid:8-11`), so at today's copy this likely stays within a 375px viewport, but there's no structural guard if a longer message is ever added later. | Add `max-width: calc(100vw - 48px)` and drop `white-space: nowrap` in favor of normal wrapping (or `text-wrap: balance`), so a future longer message can't push the bubble off-screen. | Low |

## 3. Tables / wide grids without horizontal-scroll fallback

Both current comparison tables have the `.tbl-wrap` (`overflow-x:auto`) fallback correctly
applied — see "Confirmed-fine" above. One forward-looking note, not a current bug:

| File | Line | Issue | Suggested fix | Confidence |
|---|---|---|---|---|
| `sections/vergelijk-pakketten.liquid` | 82 (`.soon` badge, "Prijzen volgen binnenkort") | The Mijn Thuis line is currently rendered as a `.cmp-card` (a simple card in the `.cmp-more` grid), not a `.cmp-tbl` table — so there's nothing to check yet. Per `todo-tracker.md`, once Mijn Thuis pricing is filled in, if it becomes a comparison **table** rather than staying a card, it needs the same `.tbl-wrap` treatment the Inzicht/Zeker/Beschermd table already has, or it'll be the one table in the theme without a horizontal-scroll fallback. | No action now — just don't forget the wrapper when that table gets built. | N/A (forward-looking, not a current defect) |

No other custom `<table>` elements exist outside the two `.cmp-tbl` instances and Dawn's own
stock account/order tables (out of scope, see Context above).

## 4. Typography that doesn't scale down

The `clamp()` pattern flagged as "good, but check if applied consistently" in the brief **is**
applied consistently — every page-hero `h1` found (13 sections + `zv-chrome.css`,
`zv-vergelijk-pakketten.css`, `zv-policy.css`, `zv-article.css`, `zv-kc.css`) uses `clamp()`.
One section breaks the pattern:

| File | Line | Issue | Suggested fix | Confidence |
|---|---|---|---|---|
| `sections/borg.liquid` | 73 | `.zv-borg h1 { font-size: 38px; ... }` — fixed px, no `clamp()` and no `@media` override at any breakpoint. Every other hero `h1` in the theme (14 other instances checked) uses `clamp()` instead. Text will still wrap at narrow widths (no hard overflow), but the heading won't shrink the way every other page's hero does, which is visually inconsistent and was presumably meant to use the same pattern. | Replace with `font-size: clamp(28px, 4vw, 38px)` (or similar), matching the pattern used elsewhere (e.g. `betaling-mislukt.liquid:48`, `gids-bedankt.liquid:46`). | High |

Body/lead paragraph text (`.lead`, `.sub`, etc.) is fixed px (14.5–17px) everywhere in the
theme, including on pages with a `clamp()` hero — this is consistent, standard practice (body
text doesn't usually need fluid scaling the way large display headings do) and is **not**
flagged as an inconsistency.

## 5. Crowding at ≤375px (icon rows, badge rows, CTA groups)

| File | Line | Issue | Suggested fix | Confidence |
|---|---|---|---|---|
| `sections/zv-header.liquid` | 58–79; CSS `assets/zv-chrome.css:92` (`.sf-right`) | On mobile (≤980px, where `.sf-links` is hidden), `.sf-right` can render up to **four** elements in a row with 18px gaps: the search icon, the cart icon (with an overlapping `.dot` badge), the header CTA button (`section.settings.cta_text`, **default "Zakelijk"** — i.e. present out of the box, not opt-in), and the `.sf-burger` drawer trigger. No breakpoint hides or shrinks the CTA button. Rough width budget at 375px: `.wrap` padding eats ~40px (20px × 2, per the `clamp(20px,3.6vw,52px)` floor), leaving ~335px for logo + all four `.sf-right` items — a "Zakelijk" gold button alone (with its own padding) plus the three icons/burger is likely to meaningfully exceed that alongside the logo. This is the same `.sf-right` crowding concern noted as unconfirmed in the nav-drawer work — now backed by the specific markup/CSS reasoning above, but still not visually confirmed. | Hide the CTA button on mobile (`@media (max-width: 980px) { .sf-right .btn { display: none; } }`), or move it inside the `.sf-drawer` panel instead of the persistent top row. | Medium |
| `sections/zv-header.liquid` | 16–29 (`.util` bar); CSS `assets/zv-chrome.css:60-70` | The utility bar's right side (`.u-r`) renders the Theme-Editor-configured utility menu links (variable count/length) plus a phone link (hidden ≤720px via `.hideph`). `.util .wrap` has a fixed `height: 38px`; if an editor assigns a utility menu with several/long link items, `.u-r`'s content could wrap to a second line and be clipped by or overflow the fixed-height bar. Content-dependent — can't confirm without knowing what's actually assigned in the Theme Editor's "Utility-menu" setting. | If not already the case, consider letting `.util .wrap` grow (`min-height` instead of fixed `height`) or capping/truncating the utility menu to a safe number of items. | Low (content-dependent judgment call) |

No other icon-row/badge-row/CTA-group crowding was found in the package cards, comparison
table headers, or FAQ/accordion rows checked — those either stack to one column below 720–900px
or were already single-column-friendly (buttons at `width:100%` in `.pcard__cta`, etc.).

---

## Summary

| Category | Findings | High confidence | Medium | Low |
|---|---|---|---|---|
| 1. Tap targets | 9 | 1 | 6 | 2 |
| 2. Fixed widths | 1 | 0 | 0 | 1 |
| 3. Tables | 1 (forward-looking, not a current defect) | — | — | — |
| 4. Typography | 1 | 1 | 0 | 0 |
| 5. Crowding | 2 | 0 | 1 | 1 |

**Most worth prioritizing**, in the reporting session's judgment (Thijs decides scope/order):

1. **`.sf-right` mobile crowding** (§5, row 1) — highest-impact if confirmed, since it's the
   same "header unusable on phone" failure mode as the nav-drawer bug this audit was
   triggered by, just one layer deeper (four controls crammed into the same space the drawer
   fix already had to solve for). Worth a real-device/screenshot check before building a fix.
2. **`.sf-iconlink`/`.cart` tap targets** (§1, row 1) — already pre-confirmed, cheapest fix
   (padding only, no layout change), and the most textbook a11y/mobile-UX violation in this
   list.
3. **`.zv-borg h1` fixed font-size** (§4) — trivial one-line fix, and the only true
   inconsistency found in an otherwise clean, consistent `clamp()` pattern across 14+ other
   heroes.

Everything else (the remaining tap-target rows, the Lio bubble, the utility-bar wrap risk) is
lower-impact or more speculative — reasonable to batch into the same implementation session as
the above three if a browser check confirms them, but none seemed worth a dedicated fix on
their own.
