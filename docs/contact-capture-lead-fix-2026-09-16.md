# Contact-page capture-lead 401: root cause, fix, and live status (2026-09-16)

**Status: fix verified locally and pushed to the live theme. Not yet pushed to `origin`
(blocked, see below). Live functional confirmation still needs Thijs (storefront
password wall).**

## Root cause

`sections/contact-page.liquid` reads `section.settings.capture_lead_endpoint` /
`section.settings.capture_lead_anon_key` to build the form's
`data-capture-lead-endpoint` / `data-capture-lead-key` attributes, which the form's
`fetch()` then uses directly as the URL and as the `apikey`/`Authorization: Bearer`
headers. Both settings were declared in the section's schema with no `"default"`, and
nothing in `config/settings_data.json` set them at the section level — so they rendered
empty, the fetch went to `""` with an empty bearer token, and Supabase returned 401.

**The real values already existed in the repo, just in the wrong place.** They sit as
top-level keys directly under `presets.Default` in `config/settings_data.json`:

```
"presets": {
  "Default": {
    "capture_lead_endpoint": "https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/capture-lead",
    "capture_lead_anon_key": "eyJhbGc...twaE",
    ...
```

`presets.Default` feeds **global** `settings.*` (from `settings_schema.json`), not a
section's `section.settings.*`. Since `capture_lead_endpoint`/`_anon_key` are settings
scoped to the `contact-page` section (not global settings), nothing ever reads this
object — they're orphaned.

**This is why the bug survived a week despite being reported fixed twice.** Two prior
sessions (`docs/promote-live-lead-settings-2026-09-15.md`,
`docs/callback-endpoint-live-2026-09-15.md`) patched these same orphaned keys directly
into the *live theme's* `config/settings_data.json` via a scoped
`shopify theme push --only config/settings_data.json --allow-live`, verified with a
zero-diff re-pull, and reported it done. That verification was real but insufficient:
a) it confirmed the *push* landed, not that the *setting was ever read* by the section
(it wasn't — same orphaned-key problem, now live too), and b) since the patch was
live-only and never committed to git, it was one `origin main` → Shopify GitHub sync
away from being silently overwritten again. Both sessions were also blocked from the
one check that would have caught this — submitting the actual Contact form — by the
storefront password wall, and said so explicitly rather than assuming success.

## Fix

Added the same two values as `"default"` on the section's own schema settings in
`sections/contact-page.liquid`, copied verbatim from the orphaned preset keys above (not
retyped):

```diff
   "id": "capture_lead_endpoint",
   "label": "capture-lead endpoint URL",
+  "default": "https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/capture-lead",
   ...
   "id": "capture_lead_anon_key",
   "label": "Supabase anon (public) API key",
+  "default": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...mwOnoWN2pDZ5J8nj0RfEMbnrH8HUei0C6qCKGt4twaE",
```

This makes the section work correctly even with an empty `settings_data.json` for this
instance, since a schema default applies whenever the section itself has no explicit
override — no dependency on global presets, and no risk of a future settings sync
silently reverting it. Branch: `fix/contact-capture-lead-defaults-2026-09-16`, branched
from `origin/main` (not from the stale local branch this session started on), commit
`2c19a63`. The orphaned global keys in `settings_data.json` were left alone — removing
them wasn't in scope and they're harmless dead weight now, not a live risk.

The anon key is Supabase's public/`anon` role key (confirmed by decoding the JWT
payload: `"role":"anon"`), which is safe to ship client-side by design — protected by
Supabase RLS, same as the existing code comment already states. Not a service-role key.

## Local verification

- `shopify theme dev` (port 9293, to avoid an unrelated `theme dev` process already
  running on the default port from an earlier session) rendered the Contact page with
  correct, non-empty `data-capture-lead-endpoint` / `data-capture-lead-key` attributes.
- Reproduced the form's exact outgoing request by hand (same `Content-Type`, `apikey`,
  `Authorization: Bearer` headers; same field names as the form's `FormData` → JSON
  body) against the DEV Supabase project, with an obviously-marked test entry:
  ```
  POST https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/capture-lead
  → HTTP 200, {"ok":true,"lead_reference":"LEAD-20260916-C71B75"}
  ```
  This is exactly the condition the form's JS checks (`res.ok && result.json.ok`) to
  show `#cn-ok` instead of `#cn-err-server` — confirmed working, not just "no longer
  401". **Could not independently query the DEV `leads` table** to see the row directly
  — no Supabase service-role key or DB client is available in this session, only the
  public anon key (which RLS correctly blocks from reading `leads`). The `200` +
  `ok:true` + a fresh `lead_reference` is the capture-lead function's own documented
  success signal (same evidence the 2026-09-15 sessions relied on) — recommend spot
  checking the Supabase Table Editor for `LEAD-20260916-C71B75` if you want a second
  confirmation.

## Validation sequence

1. `python3 scripts/check_pricing.py` — all checks pass (unaffected file, run per the
   standard sequence).
2. `shopify theme check` — 0 errors. 174 pre-existing warnings across 22 files,
   theme-wide baseline, unrelated to this change. `sections/contact-page.liquid`
   specifically: 0 offenses.
3. Disposable-theme validation against Shopify's real server-side Liquid validator
   (stricter than `theme check`, per this repo's `CLAUDE.md`):
   `shopify theme push --unpublished --theme zz-validate-contact-capture-lead-20260916133920
   --only sections/contact-page.liquid` → pushed clean (`#188898836861`), then deleted.
4. `git push origin fix/contact-capture-lead-defaults-2026-09-16` — **blocked**. Claude
   Code's auto-mode classifier denied the push ("Out-of-Place Publication"). The commit
   exists locally on the branch, on top of `origin/main`, ready to push — **Thijs needs
   to push this branch himself** (or re-run with the push explicitly approved) before
   opening the compare/PR link.

## Live theme (`Zoveilig-Test-shopify/main`, `#188704719229`)

**Pre-push diff check, as instructed:** pulled the live theme's actual current
`sections/contact-page.liquid` fresh (not git's copy) and diffed it against the fix
about to be pushed. The diff was **not empty**, but every line of it was explained by
the live file being frozen at an older commit of this same file — missing exactly
`b477032` ("Contact form: separate validation errors from server/network errors",
2026-09-09), confirmed via `git log -- sections/contact-page.liquid`. No content existed
on live that isn't also in git history — i.e. no independent theme-editor edit to this
file, just staleness. Treated as the "clean" case per the brief's instructions and
proceeded.

**Scoped push:**
```
shopify theme push --theme 188704719229 --only sections/contact-page.liquid --nodelete --allow-live
```
No other file was touched. **Verified after, independently**: re-pulled the live file
fresh and diffed it against the exact file just pushed — zero difference.

One side effect worth flagging explicitly: because live was a commit behind on this
file, this push also brought live the 2026-09-09 validation/server-error split
(`#cn-err-server` shown distinctly from `#cn-err`, `novalidate` + client-side required-
field checks) that git already had but live didn't. That's pre-existing, already-shipped
code from `origin/main` catching up to live via this scoped push — not new scope added
by this fix.

## Does the live Contact form actually work now?

**Not confirmed by me — same storefront password wall every prior session hit.**
`curl https://zoveiligdev.myshopify.com/pages/contact` still 302s to `/password`
regardless of theme settings or `?preview_theme_id=`; no browser tool or storefront
password is available in this session. The DEV Supabase values now live are
byte-identical to the ones verified working in the "Local verification" test above, so
functionally this should work — but that has not been visually confirmed against the
real live page and a real browser `fetch()`.

**Please do one of:**
1. Open `https://zoveiligdev.myshopify.com/pages/contact` yourself (enter the storefront
   password), submit an obviously-marked test entry, and confirm `#cn-ok` shows (not
   `#cn-err-server`); or
2. Share the storefront password so a future session can do this directly.

## Other things noticed, not acted on

- This repo has a second git remote, `veronica-origin` → `veronica1nvest/zo-veilig-platform.git`
  (a personal account, not the org). Not touched — only `origin` was used, per the brief.
  Worth confirming it's intentional (a collaborator's fork?) if you're not sure why it's there.
