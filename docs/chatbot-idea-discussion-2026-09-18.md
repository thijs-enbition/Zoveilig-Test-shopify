# Chatbot idea — discussion doc for Robi (2026-09-18)

**This is a content/product decision, not an engineering task.** It sits in the same
category as the open pakket-matcher scoring/copy sign-off (`CLAUDE.md` → **Pakket-matcher**:
"needs product sign-off (Robi/Robert)") and the FAQ-content gaps noted in
`docs/faq-content-2026-09-09.md` — something to talk through and decide, not something
Claude Code should keep building on until that decision is made.

## Status: shelved, not shipped

An AI FAQ chatbot was explored and built on a feature branch
(`feature/chatbot-faq-2026-09-17`) between 2026-09-17 and 2026-09-18. **None of it was ever
merged to `main` or opened as a PR.** As of this doc:

- The feature branch has been deleted (locally and from `origin`).
- The `chatbot-faq` Supabase Edge Function has been removed from the DEV project.
- The database schema it used (`chatbot_kb_entries`, `chatbot_rate_limits`) has been
  dropped via a reversing migration (`010_chatbot_faq_revert.sql`) — `009_chatbot_faq.sql`
  itself is not edited or removed from history, it's just undone going forward, same as
  any other migration rollback in this repo.
- The `ANTHROPIC_API_KEY` Supabase secret has been unset.

**The design write-up is kept for reference**, but a correction on where: it lives on its
own branch, `docs/chatbot-faq-design-2026-09-17` (pushed to `origin`, not merged to
`main`) — not on `main` itself. If this becomes something the team wants to keep as
permanent reference material alongside this doc, that branch needs a deliberate merge
decision too; it wasn't merged as part of shelving this.

## What was explored

An AI chatbot widget for the storefront: a floating chat launcher (sitewide, per a later
instruction — originally scoped to Klantenservice/Oplossingen/Contact only) that answers
customer questions by calling the Claude API server-side (a Supabase Edge Function,
`ANTHROPIC_API_KEY` held as a Supabase secret, never in the theme), restricted to only
answer from a knowledge base sourced from the existing 62-entry FAQ
(`templates/page.klantenservice.json`, synced into a Supabase table by a script). Guardrails
prevented it from inventing prices/package terms or making camera/microphone/medical claims
about Langer Thuis, and enforced the site's copy conventions (u-vorm, lowercase "wifi",
correct meldkamer vs. general phone number). When a visitor gave contact info or asked to be
contacted, it captured a lead through the **existing** `window.ZVLeadWebhook.send()` pipeline
into Odoo — reusing the same Supabase + Odoo dual-write and failure logging every other lead
form already uses, not a separate pipe. Full detail: `docs/chatbot-faq-design-2026-09-17.md`
(on its branch, see above).

## Why it's paused

**Ongoing Anthropic API usage cost.** Every message a visitor sends becomes a paid Claude
API call. Unlike the rest of this repo's cost surface (Shopify, Supabase, Odoo — all fixed
or usage-light), this is a new, variable, per-conversation cost with no cap decided yet
(the design doc's rate limits were placeholders, not a cost commitment). That's a real
budget decision, not an engineering one, and it's the reason nothing here shipped — not a
technical blocker.

## Three options, for Robi and Thijs to pick between

### a) Drop AI entirely — a lead-capture widget, no FAQ answering
A chat-*styled* "leave your info" widget: no AI, no FAQ knowledge base. A visitor types a
question or a request, and it goes straight to Odoo as a lead via the same
`ZVLeadWebhook.send()` pipeline — like the existing "Bel mij terug" callback form, just in a
chat-shaped UI instead of a form. Zero ongoing cost, and the simplest to build (a thin
wrapper around a pattern that already exists twice in this repo). Doesn't answer anything —
every visitor question becomes a lead for a human to follow up on, whether or not the answer
was already sitting in the FAQ.

### b) Rule-based FAQ search, no AI call
Search the same 62 existing FAQ entries (keyword/substring match, no model call) and show
the best-matching answer(s) directly, with a "still stuck? leave your info" fallback into
the same Odoo lead pipeline. Zero ongoing cost, same as (a). Can only answer what the FAQ
already says in roughly the words a visitor used — it can't paraphrase, infer intent behind
an oddly-phrased question, or hold a follow-up conversation the way the FAQ page's own
existing search/filter (`sections/klantenservice.liquid`) already can't either. This option
is closer to a better-surfaced version of that existing search than a new capability.

### c) The AI chatbot as designed
Real conversational answering, with the guardrails and lead-capture wiring already designed
and partially built (see the design doc). Costs a paid Anthropic API key per message, with
no usage cap decided yet — that's exactly the open decision this doc exists to force before
any further building resumes.

## What this doc is asking for

A decision on which of (a)/(b)/(c) — or "none of the above, drop the idea" — before any
further engineering time goes into this. Whichever direction, the shelving above (deleted
branch, deleted function, reverted schema, unset key) means starting from a clean slate, not
picking the half-built (c) back up by default.
