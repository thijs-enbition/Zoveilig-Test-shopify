# Chatbot FAQ — design doc (2026-09-17)

Status: **Draft — design only, nothing implemented.** No theme code or Edge Function has been
written. This doc exists to align on architecture, guardrails and lead-capture wiring before
any of that starts.

> **Correction on scope, up front:** the task that produced this doc asked me to read "ADR-015
> (webhook exception)". **ADR-015 does not exist.** `docs/architecture/adr/` only goes up to
> ADR-004 through ADR-014 (see `docs/architecture/adr/README.md`). The thing being referred to
> is [`docs/contact-odoo-dual-write-2026-09-16.md`](contact-odoo-dual-write-2026-09-16.md)'s
> Step 5, "Wider note: ADR-004 deviation, not new" — an informal, undocumented-as-an-ADR
> deviation from [ADR-004](architecture/adr/ADR-004-odoo-deferred-phase-2.md) ("Odoo deferred to
> Phase 2"), where several forms already write to Odoo directly via `ZVLeadWebhook.send()`
> despite ADR-004 saying Phase 1 has no Odoo dependency. This doc treats that note as the
> "webhook exception" precedent and flags below that a real ADR-015 should probably get written
> to formalize it — see **Open questions**.

## 1. What FAQ content exists today

There are three FAQ content sources in this repo. Only one of them is the right source for a
chatbot's knowledge base.

| Source | Where | Shape | Status |
|---|---|---|---|
| **Klantenservice FAQ** | [`templates/page.klantenservice.json`](../templates/page.klantenservice.json) + [`sections/klantenservice.liquid`](../sections/klantenservice.liquid) | 62 Q&A blocks (`faq1`–`faq48`, `faqlt1`–`faqlt14`) + 1 disclaimer note block (`faqlt-note`), across 11 categories, as theme-editor blocks in git-tracked JSON | **Live, canonical, git-tracked** |
| "Uit de praktijk" cards | [`sections/faq.liquid`](../sections/faq.liquid) reading `shop.metaobjects.faq_item` | 6 active short marketing-style Q&As (persona quotes), admin-managed metaobjects, not in git | Live, but a *different*, smaller, differently-shaped pool |
| Retired FAQ page | [`sections/veelgestelde-vragen.liquid`](../sections/veelgestelde-vragen.liquid) | Hardcoded, includes a stray fabricated Langer Thuis category | **Dead** — `zv-route.liquid`'s `"faq"` key was repointed to `/pages/klantenservice#veelgestelde-vragen` on 2026-09-09 (see `docs/faq-content-2026-09-09.md`). File still on disk; not linked from the theme. Do not use as a source. |

**Chosen knowledge-base source: `templates/page.klantenservice.json`.** It's the only one
that's live, structurally stable (per-block `category`/`question`/`answer`), and version
controlled. The metaobject-based "Uit de praktijk" cards are a separate, much smaller pool
living only in Shopify Admin — out of scope for v1 (see **Open questions**).

Known gaps to carry into the KB, not silently fill in (per `docs/faq-content-2026-09-09.md`):
the source document this FAQ was built from has a missing "Bijlage" appendix section and one
ToC entry with no matching body — the FAQ is not 100% complete against the original source, and
the chatbot must not paper over that by inventing an answer where the KB has none.

## 2. Copy conventions the system prompt must enforce

Confirmed directly in the live copy (`templates/page.klantenservice.json`) and in
`docs/homepage-faq-broaden-2026-09-14-draft.md`'s explicit house rules:

- **u-vorm**: "u"/"uw", never "je"/"jouw" — used with zero exceptions across all 62 FAQ answers.
- **Lowercase "wifi"**: e.g. "een stabiele wifi-verbinding van 2,4 GHz" — never "WiFi"/"Wifi" in
  body copy (product *titles* elsewhere do say "WiFi", but that's Shopify product-title casing,
  not conversational copy the bot should imitate).
- **"Meldkamer" phrasing**: "de meldkamer van Securitas" is the 24/7 alarm-response service —
  distinct from "klantenservice" (general support). It has its own number, **040 289 41 41**,
  separate from the general line. The bot must not conflate the two numbers or the two services.
- **No camera/microphone claims for Langer Thuis.** Directly from the `faqlt-note` block:
  > "Langer Thuis is een hulpmiddel dat u inzicht geeft in het dagritme van uw naaste. Het
  > systeem detecteert geen vallen en is geen medisch alarmeringssysteem. Bij twijfel over de
  > gezondheid van uw naaste belt u altijd zelf een (huis)arts of 112."

  Langer Thuis uses smart sensors, not cameras or microphones, and does not do fall detection or
  automatic emergency-service calling. The system prompt must refuse to affirm any of those
  capabilities even if a user asks a leading question ("does it have a camera so I can check in
  on my mother?").
- **Phone number: 088 122 11 11** is the one general number the bot may give out for anything
  not meldkamer-specific (it appears in ~a dozen FAQ answers and as the page's default `phone`
  theme setting). It must never be swapped for the meldkamer number or vice versa.
- **Health-data sensitivity**: `docs/compliance/README.md` flags that Langer Thuis
  wellbeing/routine monitoring "may constitute health data about vulnerable adults," which is
  why no medical/health claims should be made — this is a compliance constraint, not just a
  copy-style one.

## 3. Architecture

```
Storefront page
  └─ theme snippet: snippets/zv-chatbot.liquid (name TBD)
       - renders chat widget UI
       - assets/zv-chatbot.js: manages conversation state client-side,
         calls the Edge Function per turn, renders streamed/plain response
       - on "lead trigger" detected in a turn (see §5), calls the *existing*
         window.ZVLeadWebhook.send() the same way every other form does

Supabase Edge Function: supabase/functions/chatbot-faq/ (new, name TBD)
  - receives {conversation_history, message} from the widget
  - loads KB rows from a Supabase table (see below), builds the system prompt
  - calls the Claude API server-side, ANTHROPIC_API_KEY read from a Supabase
    secret (`supabase secrets set`), never present in the theme/browser
  - returns the assistant's reply (and, if it decided a lead should be
    captured, a structured signal — see §5) to the widget
  - the widget, not the Edge Function, calls ZVLeadWebhook.send() — keeping
    the Edge Function a stateless Q&A responder and reusing the existing
    lead pipeline unchanged, rather than teaching a second, parallel piece
    of server-side code how to write leads
```

**Why an Edge Function and not a client-side call to Anthropic:** the theme is public,
unauthenticated storefront code — any API key placed in `assets/*.js` or theme settings is
visible to anyone who opens dev tools. The existing pattern in this repo (`capture-lead`,
`log-webhook-failure`) already puts privileged operations behind Supabase Edge Functions with
secrets held server-side; the chatbot follows the same pattern rather than inventing a new one.

**Why a Supabase table for the KB, not hardcoded in the function:** the 62-block
`page.klantenservice.json` content changes independently of code (it's theme-editor content,
edited by non-developers). A KB stored in a Supabase table (e.g. `chatbot_kb_entries`, columns
along the lines of `category`, `question`, `answer`, `source_block_id`, `active`, `updated_at`)
can be updated — and, per this project's working rule of not inventing pricing or letting
content drift from its source — periodically synced from `page.klantenservice.json` (a small
script, analogous to `scripts/build_pricing.py`, could push the JSON's blocks into the table)
without a function redeploy. Open question: is that sync push-based (a script run after FAQ
edits) or does the function read `page.klantenservice.json` at request time via the Shopify
Admin API instead of mirroring it into Supabase at all — see **Open questions**.

**Why the system prompt must not compute or restate pricing/package composition from memory:**
this mirrors `pricing/pricing.config.json`'s own house rule verbatim — *"No page, cart,
configurator, confirmation or analytics event may compute or hardcode a price or duration
independently."* A chatbot answering "what does Zeker cost" is exactly the kind of independent
restatement that rule exists to prevent, especially since several packages
(Veilig Onderweg, several add-ons) are explicitly `PRICE_PENDING`/not-yet-purchasable in that
same config. See §4.

## 4. Guardrails

The system prompt sent to Claude on every turn must enforce, in this order of priority:

1. **Answer only from the retrieved KB rows for this turn.** No general knowledge about home
   security, no filling gaps with plausible-sounding information. If the retrieved KB rows don't
   cover the question, the bot says so and offers the general contact channel
   (088 122 11 11 / klantenservice@zoveilig.nl) rather than guessing — this directly covers the
   known content gaps noted in §1.
2. **Never invent or restate a price, package composition, or contract term.** Pricing and
   package structure are owned by `pricing/pricing.config.json`
   (→ `pricing.generated.json` / `zv-pricing.liquid`), not by FAQ prose or by the model's
   training data. If the KB doesn't already contain a plain-language pricing answer written and
   approved by the same process that owns the FAQ content, the bot should defer to a human/the
   pricing pages rather than compute one — this is the same boundary
   `scripts/check_pricing.py` enforces for theme code, applied to the model instead.
3. **No legal or medical claims.** In particular, no diagnosing, no medical advice, no promising
   emergency response beyond what a given package actually does (see the Langer Thuis
   camera/microphone/fall-detection constraint in §2 — apply the same caution to Mijn Thuis and
   Veilig Onderweg claims, sourced only from what's literally in the KB row).
4. **Copy conventions from §2 are non-negotiable style rules**, not preferences — u-vorm, lowercase
   wifi, correct meldkamer vs. klantenservice phrasing and phone numbers.
5. **When contact information appears in the conversation, follow the lead-capture trigger in §5**
   rather than just replying conversationally and letting it drop.

Implementation note: guardrails 1–3 are best enforced by (a) constraining the prompt to
answer strictly from the KB rows retrieved for that turn (retrieval-restricted, not
open-book), and (b) a lightweight post-response check server-side (e.g. reject/regenerate if the
response contains a `€` amount not present in any retrieved KB row) rather than relying on the
model's instruction-following alone for the pricing rule specifically, since that is the rule
with the highest cost if violated (a wrong quote to a customer).

## 5. Lead-capture trigger

### What counts as "the user gave contact info"

A lead should be captured when, within the conversation, the user either:
- **offers an email address or phone number** (regex/heuristic detection is enough — this
  doesn't need to be a hard NLU problem), or
- **states explicit contact intent** — e.g. "bel me terug", "neem contact met mij op", "ik wil
  een adviesgesprek" — even without yet providing a phone/email, mirroring the existing
  "Bel mij terug" widget's premise (`snippets/zv-callback-form.liquid` captures intent-to-be-called
  and its own phone field, not an inbound number the user pastes into free text).

Either signal is sufficient on its own; they're not required together. Detection happens
server-side in the Edge Function (it already sees the full turn), which returns a structured
`{lead_detected: true, extracted: {name?, phone?, email?}}` alongside its reply so the widget
knows to fire the capture — this keeps the "does this message contain a lead" judgment in one
place (the function, next to the system prompt) instead of duplicating it in client JS.

### Payload and `lead_type`

Every existing lead entry point sends its own distinct `lead_type` string so Odoo's automation
rule can branch on it — established by the `fix/lead-payload-field-alignment-2026-09-15`
fix (commit `43d4a08`: renamed Onderweg's lead_type from a leftover `'coming-soon-onderweg'`
to `'onderweg'`, and fixed camera-hardware's copy-pasted `'vista'` to `'camerahardware'`, so
every form has its own value). Existing values in use: `contact_page`, `camerahardware`,
`onderweg`, `vista`, `callback_request`. **Proposed new value: `chatbot`** — short, lowercase,
not already in use (checked against every `lead_type:` literal in the theme as of this doc).

Payload should be built the same way every other form builds one — via
`window.ZVMeasurement.buildCallbackLead({...})` — so it automatically inherits
`lead_source: 'website'`, `lead_temperature`, `page_url`, `timestamp`, and consented
attribution fields (gclid/fbclid/utm_*), with an override object supplying:

```js
{
  lead_type: 'chatbot',
  name:  extracted.name  ?? null,
  phone: extracted.phone ?? null,
  email: extracted.email ?? null,
  message: <short summary of the conversation, or the last user turn>,
  cta_location: 'chatbot_widget',
}
```

Then: **`window.ZVLeadWebhook.send(payload, 'chatbot')`**, called from the widget's client JS
exactly like `contact-page.liquid`, `camera-hardware.liquid` and `oplossingen.liquid` already do.
This is a deliberate reuse, not a new pipe: it inherits the existing no-cors POST to the Odoo
webhook, the 15s timeout/abort handling, and the best-effort failure logging to
`log-webhook-failure` (once `chatbot` is added to that function's `source` allow-list — currently
`["vista", "camera_hardware", "onderweg_coming_soon"]`, missing even `contact_page`; this is a
pre-existing gap the chatbot would simply be one more instance of, not one it creates).

**Should the chatbot also dual-write to the `capture-lead` Supabase function, like the Contact
page does?** Recommend **no for v1** — `capture-lead`'s own file header explicitly scopes it to
"the Contact page's 'Plan een gratis adviesgesprek' form" per ADR-004, and its required-field
validation (`Naam`, `Telefoon`, `email` all mandatory) doesn't fit a chatbot lead where a user
might give only an email, or only express intent with no contact details yet. Widening
`capture-lead`'s contract to accept partial chatbot leads is a scope decision for whoever owns
ADR-004, not something to fold in silently here — see **Open questions**.

## 6. Open questions for Thijs

1. **Which pages get the widget?** Every page, or a subset (e.g. Klantenservice + Oplossingen +
   Contact, where support/pre-sales questions naturally happen)? Affects load/cost and how
   prominent the entry point is.
2. **Rate limiting / abuse handling.** The Edge Function calls a paid Anthropic API per turn with
   no auth in front of it beyond being embedded in the storefront — needs a rate limit
   (per-IP/session, Supabase-side) before going live, and a plan for what happens on abuse (e.g.
   someone scripting it to run up API spend). Not designed here; needs a decision on acceptable
   limits before implementation.
3. **Where does the Anthropic API key come from?** Whose Anthropic account/billing, and who
   owns rotating it if it leaks? Needs to be set as a Supabase secret on the project before the
   function can be deployed either way.
4. **Should a real ADR-015 get written** to formalize the Odoo-direct-webhook exception
   documented informally in `docs/contact-odoo-dual-write-2026-09-16.md` (already covering
   Vista/Onderweg/camera-hardware/Contact), before the chatbot becomes a fifth instance of it?
   This doc doesn't propose the ADR itself — flagging that the gap between ADR-004 and shipped
   reality keeps growing and a chatbot lead would be one more thing it doesn't cover.
5. **Is the "Uit de praktijk" metaobject FAQ pool (§1) in scope for the KB at all**, given it
   isn't git-tracked and would need an Admin API read rather than a JSON parse? Recommend
   leaving it out of v1's KB and revisiting once the Klantenservice-only bot is live.
6. **KB sync mechanism**: a push script that mirrors `page.klantenservice.json` into the Supabase
   table on every FAQ content change (analogous to `build_pricing.py`), or does the Edge Function
   read Shopify directly at request/cache-refresh time? Affects staleness risk and who has to
   remember to run something after editing FAQ copy in the theme editor.
7. **`log-webhook-failure`'s source allow-list** doesn't yet include `contact_page` (a pre-existing
   gap) — should `chatbot` (and `contact_page`) both be added at the same time, or tracked as a
   separate follow-up?
