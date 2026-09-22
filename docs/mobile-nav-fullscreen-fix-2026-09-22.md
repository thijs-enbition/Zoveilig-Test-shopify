# Mobile nav: full-screen takeover fix — 2026-09-22

**Method: static code review only.** The root cause below was confirmed by reading
`assets/zv-chrome.css`, `sections/zv-header.liquid` and `assets/global.js` — this session
had no browser or device access, so the fix has not been live-tested. Flag it for a real
device check if the drawer still doesn't cover the full screen after this ships, same as
`fix/mobile-nav-drawer-2026-09-15` (commit `52f805a`, PR #48) was flagged for one.

## What Thijs reported

Opening the hamburger menu on a phone showed "a lot of white and then some options" —
not a full menu, and not obviously broken either. The panel was rendering, just not where
expected.

## Root cause

`.sf-nav` in `assets/zv-chrome.css` carries:

```css
.sf-nav { position: relative; background: rgba(255, 255, 255, 0.92); backdrop-filter: saturate(160%) blur(10px); -webkit-backdrop-filter: saturate(160%) blur(10px); border-bottom: 1px solid var(--line); }
```

Any element with `backdrop-filter` set (same category as `transform`, `filter`,
`perspective`) becomes the **containing block** for every `position: fixed` descendant
inside it, instead of the viewport. `.sf-drawer__backdrop` and `.sf-drawer__panel`
(`sections/zv-header.liquid`, nested inside `<menu-drawer class="sf-drawer">` which sits
inside `.sf-nav`) are both `position: fixed`. Instead of covering the screen, they were
trapped inside `.sf-nav`'s own box — the nav bar is ~78px tall
(`.sf-nav .wrap { height: 78px; ... }`), so the "drawer" rendered squeezed into that
strip: hence the white space and the few links visible without scrolling.

This is the same class of bug `zv-chrome.css` already has a comment about, just with a
different CSS property one level too high. The existing comment above
`.shopify-section-group-header-group` explains why `position: sticky` had to move up a
level (from `.sf-nav` alone to the grid item) for exactly this containing-block reason —
`backdrop-filter` on `.sf-nav` creates the same kind of trap for `position: fixed` that
sticky positioning ran into for a different property.

## The fix

**1. Break the containing-block trap.** Move the frosted-glass effect off `.sf-nav`
itself and onto a `::before` pseudo-element:

```css
.sf-nav { position: relative; isolation: isolate; border-bottom: 1px solid var(--line); }
.sf-nav::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(160%) blur(10px);
  -webkit-backdrop-filter: saturate(160%) blur(10px);
  pointer-events: none;
}
```

A pseudo-element can't have descendants, so it can't trap anything inside it.
`isolation: isolate` keeps the pseudo's `z-index: -1` scoped to `.sf-nav`'s own stacking
context instead of leaking into the page's global stacking order. Desktop's visual
appearance is unchanged — same blur, same background, same border.

**2. Redesign the drawer as a full-screen takeover ("Optie A").** Rather than just
fixing the containing block and keeping the old partial-width slide-in panel, Thijs chose
a full-screen white takeover instead (picked from three mockups): logo + close button in
a top bar, primary nav list with a gold underline on the active page, a "Meer" group for
Kenniscentrum/Klantenservice/Over ons/Contact, and the CTA + phone + trust line pinned at
the bottom. No dimmed backdrop is needed since the panel itself is opaque and covers
100% of the viewport — `.sf-drawer__backdrop` is removed entirely.

## Why a real device check still matters

The containing-block mechanics here are well-defined by the CSS spec, so the fix should
hold — but `backdrop-filter` behavior (especially `-webkit-backdrop-filter` on iOS
Safari) has a history of engine-specific quirks that don't always show up in a desktop
browser's device emulation. Confirm on an actual phone that the panel covers edge-to-edge
including the utility bar strip, and that the frosted-glass nav bar itself still renders
correctly on iOS Safari specifically.
