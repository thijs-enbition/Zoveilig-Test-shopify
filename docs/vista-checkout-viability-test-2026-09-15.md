# Vista checkout viability: does `cartCreate` register as an Abandoned Checkout? (2026-09-15)

## Verdict

**FAIL — no build work on this route, on current evidence.**

**This is not the live test the brief asked for.** The live test (steps 2–6 of the brief) could
not run: there is no Shopify Storefront API access token anywhere in this repo (confirmed by
re-grepping — matches the 09-15 design doc's finding), and creating one requires Shopify Admin
access this session doesn't have and Thijs doesn't currently have either ("access ... due to
Veronica" — his words, in this session). Thijs explicitly told me to settle the question without
API confirmation rather than wait. What follows is a **research-based verdict** from current
(2025–2026) first-hand developer reports and one direct Shopify-staff statement, not a real
`zoveiligdev` test.

**Finding: even the best case (line item + buyer identity email + full shipping address, waiting
past the ~10-minute window) does not reliably register a Storefront-API-created cart as an
Abandoned Checkout.** Per a Shopify staff reply (March 2026, see below), abandoned-checkout
creation is tied to **the checkout session itself** — i.e. the hosted checkout page actually
being loaded — **not to the Cart object**. `cartCreate` never creates a checkout session by
itself; it only returns a `checkoutUrl` that *would* create one if visited. Multiple independent
developers across Jan 2025–Apr 2026 report exactly this failure mode, including one who *did*
load the resulting `checkoutUrl` in a headless browser (closest thing to a live test in the
public record) and still got no abandoned-checkout entry.

This confirms, rather than resolves, the design doc's §2 concern: **"build a checkout silently
from JS, no navigation through cart UI" is not achievable with the Cart API as it exists today.**

## What was supposed to happen vs. what happened

The brief asked for: create a real cart via `cartCreate` against `zoveiligdev` with a real line
item, a throwaway email in `buyerIdentity`, and a full Dutch shipping address; leave it abandoned;
wait 15+ minutes; check Shopify Admin's Abandoned Checkouts and Odoo CRM for a matching Lead.

What actually happened:

1. Set up the isolated worktree/branch per the brief's guardrails
   (`docs/vista-checkout-viability-test-2026-09-15`, off `zo-veilig-platform`).
2. Re-checked the repo for an existing Storefront API token (theme settings, liquid, JSON) —
   confirmed none exists, matching the 09-15 design doc.
3. Asked Thijs before creating new credentials, per the brief's own guardrail. Thijs confirmed he
   doesn't have Shopify Admin access right now ("due to Veronica") to create a custom app/token,
   and told me to settle the question without a live API call instead.
4. No browser tool (e.g. claude-in-chrome) is connected in this session either, so even if a
   token had existed, verifying Shopify Admin's Abandoned Checkouts list and Odoo CRM Leads
   directly wasn't possible this session regardless.
5. **No cart was created. No API calls were made against `zoveiligdev` or any other store. No
   Admin settings, products, or the Vista form were touched.**

Net effect: steps 1–6 of the brief did not execute. This document instead answers the underlying
question the test was meant to answer, from public evidence, so the design decision doesn't stay
blocked indefinitely on Admin access.

## Research findings

Sources, newest first (dates matter here — Shopify has changed this behavior before, and the
Checkout API itself was permanently shut down April 1, 2025, so pre-2025 reports about
`checkoutCreate` are not evidence about the current `cartCreate`-only world):

- **[Shopify Dev Community: "checkoutUrl created via cartCreateMutation does not Create Abandoned
  Checkout on Dashboard"](https://community.shopify.dev/t/checkouturl-created-via-cartcreatemutation-does-not-create-abandoned-checkout-on-dashboard/32713)**
  (thread active late March–April 2026, i.e. this year, ~6 months before this test). Multiple
  developers confirm carts created via `cartCreate` with buyer identity and shipping/delivery
  address pre-filled do not appear as abandoned checkouts. **A Shopify staff member
  (Liam-Shopify) states the Storefront Cart API "does not fire webhooks for cart/create or
  cart/update," and that abandoned-checkout creation depends on "the checkout session itself, not
  the cart"** — i.e., on the hosted checkout page actually being loaded, not on the Cart object
  existing. One developer (Parth_Arora) went further than any purely-API test: they opened the
  resulting `checkoutUrl` in a headless browser, let it load, waited ~10 seconds, then closed the
  session — full buyer identity and address were pre-populated correctly on the page — and it
  still never appeared as abandoned. Another participant (FeatureForgerV1) called programmatic
  abandoned-checkout creation "a never winning battle," reporting attempts getting "bot blocked."
  Thread remained unresolved as of the fetch date.

- **[Shopify Dev Community: "Query regarding creating abandoned checkout using cart
  API"](https://community.shopify.dev/t/query-regarding-creating-abandoned-checkout-using-cart-api/5392)**
  and its mirror, **[GitHub: Shopify/shopify-app-js issue
  #1916](https://github.com/Shopify/shopify-app-js/issues/1916)** (both posted Jan 2025, i.e.
  the Cart-API-only era). Developer reports that `cartCreate` with `lines`, `buyerIdentity`,
  *and* `deliveryAddress` all populated "doesn't consistently appear" in Abandoned Checkouts, and
  found no documentation describing any supported way to mark a Cart-API cart as abandoned. No
  Shopify staff reply on either.

- **Shopify's own Help Center definition of an abandoned checkout**
  ([help.shopify.com/.../abandoned-checkouts](https://help.shopify.com/en/manual/promoting-marketing/create-marketing/abandoned-checkouts))
  frames abandonment around a **checkout** that stays incomplete after contact info is entered —
  consistent with the staff statement above that the checkout *session* is the trigger, not a
  Cart object.

I did not find any 2025–2026 report of a developer succeeding at getting a pure `cartCreate` call
(no checkout-page visit at all) to register as an abandoned checkout, with or without shipping
address, with or without the ~10-minute wait. The one report closest to "best case" (identity +
address + actually loading the checkout URL) still failed.

## Answer to the brief's specific question

> does it need buyer identity AND a full shipping address, plus a ~10 minute delay?

Based on this research: **that combination is necessary but evidently not sufficient.** The
missing ingredient, per the only Shopify-staff statement found, is the checkout **session**
itself — meaning the hosted checkout page has to actually be loaded (by a real browser context,
not just referenced by URL) before Shopify's abandonment logic engages at all. A pure
server/API-side `cartCreate`, no matter what fields are populated on it, appears not to create
that session. This can't be fully confirmed without Thijs's own live test once Admin access is
available (see below), but every current public report points the same direction.

## Recommendation

- **Treat design doc §2's central premise as settled in the negative** until/unless a live
  `zoveiligdev` test says otherwise: a silent, no-navigation `cartCreate` call is not a viable
  mechanism for triggering Shopify's native abandoned-checkout → Odoo CRM Lead sync.
- The design doc's own fallback framing (§2, second-to-last paragraph) — redirecting the visitor
  to a real, possibly pre-filled/disguised Shopify checkout page after Vista form submit — is the
  only variant with any public evidence of working, since it actually creates a checkout session.
  That's a materially more visible UX change and a separate design decision, not a small tweak.
- **If Thijs wants full certainty rather than inference from public reports**, the real
  `zoveiligdev` test from the original brief is still worth running once (a) Shopify Admin access
  is available to create a Storefront API custom app/token, and (b) a browser tool is connected
  this session (or Thijs checks Admin/Odoo himself) to read the result. Given how consistent and
  recent (through March–April 2026) the negative reports are, I'd expect that test to fail too —
  but it's cheap and would remove the last bit of doubt.
- No code, settings, or products were touched by this investigation; `ZV_LEAD_ENDPOINT` and
  Vista's form are untouched, consistent with the brief's guardrails.
