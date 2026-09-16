# Contact form fix — resolution status (2026-09-16)

This supersedes [`contact-capture-lead-fix-2026-09-16.md`](contact-capture-lead-fix-2026-09-16.md)
(root cause + fix + local verification, written mid-fix) and
[`live-theme-sync-check-2026-09-16.md`](live-theme-sync-check-2026-09-16.md) (a separate,
broader process check into why live drifts from `origin/main` in general). Read those for
detail; this doc is the one with the actual end state.

**Status: fixed, merged to `origin/main`, confirmed live and byte-identical. Only remaining
step is a real-browser functional click-through, blocked by the storefront password wall.**

## Root cause (unchanged from the earlier doc)

`sections/contact-page.liquid`'s form posts to `section.settings.capture_lead_endpoint` /
`section.settings.capture_lead_anon_key`. Both were section-scoped schema settings with no
`"default"`, and `templates/page.contact.json` sets `"settings": {}` for this section instance
— so both rendered empty, the fetch went to `""` with an empty bearer token, and Supabase
returned 401 on every submission. The real values existed in the repo the whole time, but only
as orphaned top-level keys under `presets.Default` in `config/settings_data.json` — which feeds
global `settings.*`, not this section's `section.settings.*`, so nothing ever read them.

## Fix (already merged)

Added the same two values as `"default"` directly on the section's own schema settings in
`sections/contact-page.liquid` (verified on this session's fresh `origin/main` checkout,
`sections/contact-page.liquid:229` and `:236`):

```json
{ "id": "capture_lead_endpoint", "default": "https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/capture-lead" }
{ "id": "capture_lead_anon_key", "default": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...mwOnoWN2pDZ5J8nj0RfEMbnrH8HUei0C6qCKGt4twaE" }
```

This makes the section work with an empty `settings_data.json` override, independent of the
orphaned global preset keys (left in place — harmless dead weight, out of scope to remove).

Merged via PR #59 (`fix/contact-capture-lead-defaults-2026-09-16` → `main`, merge commit
`7c367ca`). The earlier doc's "blocked on push to origin" note is resolved — the branch did
reach `origin/main`.

## This session's fresh verification (2026-09-16, later same day)

Started per the brief: `git worktree add ../zv-contact-form-fix-2026-09-16 -b
fix/contact-form-2026-09-16`. That branch was initially cut from a stale local checkout
(`fix/robi-feedback-content-2026-09-11`, missing PR #59 and #58); reset to fresh
`origin/main` (`7c367ca`) before doing anything else, since no commits existed on it yet.

No code change was needed — `sections/contact-page.liquid` on `origin/main` already has the
fix. What this session did instead was confirm that independently, end to end:

1. **Repo state**: confirmed both `default` values present on `origin/main` at the lines
   above, byte-identical to the values documented in the original fix.
2. **`git blame`** on those two lines shows they were last written by `shopify[bot]` via an
   "Update from Shopify for theme Zoveilig-Test-shopify/main" sync commit (`1edcd88`,
   2026-09-16 11:43 UTC) — i.e. Shopify's own GitHub sync pulled this exact content back
   *from the live theme*, independent confirmation the live theme already had it before this
   session started.
3. **Live pull + diff**: `shopify theme pull --theme 188704719229 --only
   sections/contact-page.liquid` into a scratch dir, diffed against `origin/main`'s copy —
   **zero difference**. No theme-editor-only content exists on live for this file; nothing to
   report per the brief's "STOP if you find drift" instruction.
4. **`python3 scripts/check_pricing.py`** — all checks pass (file unaffected by this change,
   run per the standard validation sequence).
5. **`shopify theme check`** — 174 warnings across 22 files (pre-existing, theme-wide
   baseline); `sections/contact-page.liquid` has 0 offenses, same as the original fix's
   validation.

Because the live theme and `origin/main` are already confirmed identical for this file, no
disposable `zz-validate-*` push, no new scoped `--allow-live` push, and no `git push origin
fix/contact-form-2026-09-16` code commit were needed — there is nothing left to push. This doc
itself is the only new commit on that branch; push it and open a docs-only PR the normal way if
you want it merged, or just keep it as a local record.

## Live functional confirmation — still open

**Not yet confirmed by either this or the prior session** — same blocker both times:
`https://zoveiligdev.myshopify.com/pages/contact` sits behind the storefront password wall, and
no password is available in this or the prior session's environment (checked: not in the repo,
not in `shopify.theme.toml`, not in the shell environment).

The DEV Supabase values that are now live are byte-identical to the ones the prior session
verified end-to-end against the real `capture-lead` Edge Function (`POST` →
`200 {"ok":true,"lead_reference":"LEAD-20260916-C71B75"}`, the exact success condition the
form's JS checks to show `#cn-ok` instead of `#cn-err-server`). Functionally this should work,
but it has not been confirmed with a real browser submission against the live page.

**Needed to close this out — one of:**
1. Thijs opens `https://zoveiligdev.myshopify.com/pages/contact`, enters the storefront
   password, submits an obviously-marked test entry, and confirms `#cn-ok` shows; or
2. Share the storefront password with a future session so it can do this directly.

## Bottom line (as of the verification above)

- Fix is correct, merged, and live — confirmed by direct diff against the live theme, not just
  by re-reading the prior session's notes.
- No further code or config changes are needed **for the settings-default bug**.
- The only open item is a real-browser click-through on the live Contact page, which needs
  Thijs (or the storefront password).

**This turned out to be wrong — see below.** The settings fix was necessary but not
sufficient; a real-browser test against live surfaced a second, unrelated bug.

## 2026-09-16, later same day — real-browser test reveals a second bug: CORS preflight rejection

Thijs supplied the storefront password directly in this session. Ran a real Chromium browser
via Playwright (`headless: false` succeeded — no fallback needed) against the actual live
storefront, not `shopify theme dev`, per this task's explicit instruction that local dev already
passes and isn't reproducing the live failure.

**Procedure**: launched Chromium, went to `/password`, filled and submitted the password form,
navigated to `https://zoveiligdev.myshopify.com/pages/contact`, then forced two reloads — a
normal `page.reload()` plus a second reload with `Network.setCacheDisabled` via CDP — to rule
out a stale cached pre-fix page. Then read the form's data attributes directly from the live
DOM, filled Naam/Telefoon/E-mailadres, submitted, and captured console + network activity with
millisecond timestamps relative to the submit click.

### DOM state on this live load (rules out settings/caching as the cause)

```
data-capture-lead-endpoint = https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/capture-lead
data-capture-lead-key      = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ...qCKGt4twaE  (208 chars)
```

Both non-empty and matching the expected DEV Supabase project ref and anon key exactly. The
schema-default fix from earlier today is confirmed rendering correctly on a hard-reloaded live
page — the settings bug is genuinely fixed. Something else is now failing.

### Outgoing request (captured, headers exactly as sent)

```
POST https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/capture-lead
content-type: application/json
authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...mwOnoWN2pDZ5J8nj0RfEMbnrH8HUei0C6qCKGt4twaE
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...mwOnoWN2pDZ5J8nj0RfEMbnrH8HUei0C6qCKGt4twaE
referer: https://zoveiligdev.myshopify.com/
body: {"Naam":"Playwright Test","Telefoon":"0612345678","email":"playwright-test@example.com","Onderwerp":"advies","Voorkeurstijd":"any","body":"","Bron":"Contactpagina","website":""}
```

Correctly formed, real Authorization/apikey headers matching the DOM values. **No response was
ever received** — the browser never got past its own CORS preflight check, so there's no
response status or body to report (not a Supabase 401/500, not a network-level timeout — a
browser-side CORS block before the real request left the browser in a usable form).

### Exact console error (verbatim, this is the actual failure)

```
[t=14.92s, +0.39s after submit click] [error]
Access to fetch at 'https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/capture-lead' from
origin 'https://zoveiligdev.myshopify.com' has been blocked by CORS policy: Request header
field authorization is not allowed by Access-Control-Allow-Headers in preflight response.

[t=14.92s, +0.39s after submit click] [error]
Failed to load resource: net::ERR_FAILED
```

The UI shows `#cn-err-server` (confirmed via `isVisible()` check) — same generic banner as
before, because the form's JS can't distinguish a CORS block from any other fetch failure. It
looks identical to the original 401 symptom from the browser user's side, which is exactly why
this second bug was invisible until a real cross-origin browser request was tested.

**One unrelated console line, noted for completeness, not investigated further**: a `404`
logged at t=0.87s, *before* the form was even touched (page-load time, not submit-time). A
site-wide listener for all 4xx/5xx responses on the page was empty for that whole window, so
this 404 isn't tied to any request Playwright's network events captured — plausibly a
browser-level resource fetch outside the page's tracked frame (e.g. favicon), not a page
network request. Not the capture-lead call (that failed via CORS block, not a 404, 14 seconds
later). Flagging only so it isn't mistaken for the real bug by a future reader of raw console
output — it is not.

### Root cause: `Access-Control-Allow-Headers` mismatch, confirmed in source

`supabase/functions/capture-lead/index.ts:37-46`:

```ts
function corsHeaders(origin: string | null): HeadersInit {
  const allowed = allowedOrigins();
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}
```

`Access-Control-Allow-Headers` lists only `content-type`. The form's `fetch()` (by design,
per the code comment in `contact-page.liquid`) sends `authorization: Bearer <anon key>` and
`apikey: <anon key>` — both required by Supabase's function gateway — neither of which is in
this allow-list. The browser's preflight (`OPTIONS`) check rejects the follow-up `POST` before
it's sent. `Access-Control-Allow-Origin` itself is *not* the problem — the browser's error
names the `authorization` header specifically, meaning the origin check already passed
(`zoveiligdev.myshopify.com` is present in the function's `ALLOWED_ORIGINS`), it's purely the
headers allow-list that's short two entries (`authorization`, and by the same logic `apikey`
would fail the same way once `authorization` is fixed).

**Not fixed in this session, per the task brief** — a CORS fix means redeploying the Supabase
Edge Function (`Access-Control-Allow-Headers` needs `content-type, authorization, apikey`, at
minimum), which is a different, separate change from today's earlier theme-only fix and
deliberately left for its own change/deploy cycle rather than bundled in here.

### Updated bottom line

- The settings-default fix from earlier today is real and confirmed live — it was necessary,
  just not sufficient.
- The actual reason every live submission still fails: `capture-lead`'s CORS
  `Access-Control-Allow-Headers` response doesn't include `authorization` (or `apikey`), so the
  browser blocks the request at the preflight stage before Supabase ever sees it. This explains
  why `shopify theme dev` "passed" in the earlier fix session — that verification POSTed with
  `curl`/hand-built headers outside a browser, which has no CORS enforcement, so it never hit
  this check.
- Next step: redeploy `supabase/functions/capture-lead` with `authorization, apikey` added to
  `Access-Control-Allow-Headers`, then repeat this same real-browser test to confirm `#cn-ok`.

## 2026-09-16, later still — CORS fix deployed and confirmed live end-to-end

**Status: fixed, deployed, and confirmed working — this closes the thread.** Every prior open
item (settings defaults, CORS preflight, live functional confirmation, a real DB row) is now
verified. The Contact form works on the live storefront right now.

**Note on this doc's own history**: this section was written on a fresh branch cut from
`origin/main` after PR #60 (the previous section) was merged — but that merge happened
*before* this doc's second section (the CORS diagnostic findings above) was pushed, so
`origin/main` briefly had only the first half of this file. This edit was based on the
complete version (pulled from the still-open `fix/contact-form-2026-09-16` branch) to avoid
silently dropping that section when this branch merges — flagging it so the discrepancy isn't
mistaken for a mistake if the two branches' history looks odd later.

### The fix

`supabase/functions/capture-lead/index.ts:43`:

```diff
-    "Access-Control-Allow-Headers": "content-type",
+    "Access-Control-Allow-Headers": "content-type, authorization, apikey",
```

Branch `fix/capture-lead-cors-2026-09-16`, commit `664e1f0`, cut from a fresh `origin/main`
(`e36d0fc`, which already includes the settings-defaults fix and its docs).

**`supabase/functions/log-webhook-failure/index.ts` checked, left unchanged.** Its
`Access-Control-Allow-Headers` was already `"content-type, apikey, authorization"` — correct
from the start. Confirmed its only caller, `assets/zv-lead-webhook.js`, does send `apikey` and
`Authorization` headers from the browser (lines 33-34), so this wasn't a "never called with
those headers" case that could be left alone by omission — it's a case that was already
handled correctly, unlike `capture-lead`.

### Deploy

No stored Supabase credentials exist anywhere in this repo, the shell environment, or
`shopify.theme.toml` (checked again before asking) — same situation the 2026-09-15 deploy
session documented in `supabase-deploy-2026-09-15.md`. The Supabase CLI's normal `supabase
login` device flow doesn't work in this non-interactive session
(`LegacyLoginMissingTokenError: Cannot use automatic login flow inside non-TTY environments`),
so Thijs supplied a Personal Access Token directly in-session, same as the 2026-09-15 session.
Confirmed the token's scope first (`supabase projects list` → exactly one project,
`lfwkpbooieiesuvblvse`, matching the DEV project this whole thread has been about — not the
unrelated `mnxgdoyqrhhhoaeahslu` PROD ref in `.mcp.json`).

```
npx supabase functions deploy capture-lead --project-ref lfwkpbooieiesuvblvse
→ {"project_ref":"lfwkpbooieiesuvblvse","functions":["capture-lead"],"message":"Deployed Functions."}
```

Confirmed via `supabase functions list`: `capture-lead` now at **version 5** (`updated_at`
newer than `log-webhook-failure`'s, which wasn't touched), **`verify_jwt: true`** (checked
explicitly — the 2026-09-15 session found a deploy-flag gotcha that silently disabled JWT
verification on a previous occasion; not repeated here, no flags were passed this time).

### Real-browser re-verification (same method as the diagnostic session, same script)

Thijs supplied the storefront password again. Playwright, real Chromium (`headless: false`),
`/password` → contact page → two forced cache-bypassing reloads → read DOM → fill → submit →
capture console + network with timestamps, identical procedure to the diagnostic run that
found the bug, run again against the deployed fix.

**Console: clean.** Only two pre-submit, pre-existing, unrelated lines (a password-form
accessibility notice and the same unexplained early 404 noted in the diagnostic session — still
not tied to any tracked request, still not the capture-lead call). **No CORS error, no
`Failed to load resource`, nothing at all logged around the submit action this time** — compare
directly against the diagnostic session's two `[error]` lines that appeared at this exact point
before the fix.

**Network: real 200 response**, captured with full headers this time (the diagnostic run never
even got a response — this run did):

```
POST https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/capture-lead → 200
access-control-allow-headers: content-type, authorization, apikey
access-control-allow-origin: https://zoveiligdev.myshopify.com
body: {"ok":true,"lead_reference":"LEAD-20260916-C98A12"}
```

**DOM: `#cn-ok` visible, `#cn-err-server` and `#cn-err` both not visible** — checked
programmatically (`isVisible()`), not inferred from the response alone.

### Real Supabase row, queried directly (not just trusting the `200`)

Per the brief, queried the actual DEV database this time rather than trusting the fetch
response — via the Supabase Management API's SQL endpoint
(`https://api.supabase.com/v1/projects/lfwkpbooieiesuvblvse/database/query`, same Personal
Access Token, no separate service-role key or DB password needed). Took a baseline count
first (1 pre-existing row from the earlier `curl` verification), then queried specifically for
this run's `lead_reference`:

```
leads:          {"lead_reference":"LEAD-20260916-C98A12",
                  "email":"playwright-cors-verify-2026-09-16@example.invalid",
                  "status":"contact_requested",
                  "created_at":"2026-09-16 13:44:46.438978+00"}
status_history: {"entity_type":"lead","new_status":"contact_requested",
                  "changed_by":"capture-lead",
                  "created_at":"2026-09-16 13:44:46.645002+00"}
```

Both rows exist, both timestamps match the request, both match the email this run's Playwright
script filled in. This is a real row from a real browser submission through the real live
storefront, not a `curl` simulation and not an inferred success.

### Git

Only `supabase/functions/capture-lead/index.ts` changed (confirmed via `git status`/`git diff`
before committing — a stray `supabase/.temp/` CLI cache directory from the deploy was left
untracked and not added). `shopify theme check` doesn't apply (no theme file touched).
Committed (`664e1f0`) and pushed to `origin/fix/capture-lead-cors-2026-09-16`. No PR opened —
Thijs opens it manually.

### Does this close the thread?

**Yes.** Chronology across all three sessions today:
1. Settings defaults missing → fixed, merged, confirmed live (`contact-capture-lead-fix-2026-09-16.md`, first section of this doc).
2. Real-browser test found a second bug the settings fix didn't touch — CORS preflight
   rejecting `authorization`/`apikey` headers (previous section of this doc).
3. **This section**: CORS fix deployed, and independently re-verified with the same
   real-browser method that found the bug — clean console, real `200`, `#cn-ok` visible, and an
   actual new row in `leads`/`status_history` for this exact submission.

No further known issues. If the form breaks again, it's a new bug, not a recurrence of either
of these two.
