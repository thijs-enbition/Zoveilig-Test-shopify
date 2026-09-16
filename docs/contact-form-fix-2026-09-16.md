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

## Bottom line

- Fix is correct, merged, and live — confirmed by direct diff against the live theme, not just
  by re-reading the prior session's notes.
- No further code or config changes are needed.
- The only open item is a real-browser click-through on the live Contact page, which needs
  Thijs (or the storefront password).
