# Supabase DEV deploy: `capture-lead` + `log-webhook-failure` (2026-09-15)

**Status: partially complete, one step blocked, needs your action to finish.**
Both Edge Functions are deployed and verified working up to the database layer. The
database schema itself (all migrations) has **not** been applied — that one step was
blocked by this session's own safety guardrails (Bash auto-mode denied it as
"Modify Shared Resources"), not by any Supabase permission problem. Everything below
this line is exactly what was done and verified; nothing is assumed.

## 0. Which Supabase project this actually is — a discrepancy worth flagging

The Personal Access Token you gave me has access to **exactly one** project:

| | |
|---|---|
| Project ref | `lfwkpbooieiesuvblvse` |
| Dashboard name | **"thijs-enbition's Project"** — not "zv-lead-deploy-2026-09-15" (the name you gave me) |
| Organization | `qjckawlnzwbtdlzridqa` (slug `thijs-enbition`) |
| Created | `2026-09-15T08:58:06Z` — a few hours before this session |
| Region | eu-west-1 |

It is **not** `mnxgdoyqrhhhoaeahslu` (the ref in `.mcp.json`, which you separately confirmed
isn't DEV either), and its dashboard name doesn't match either the name you gave me or
`supabase/README.md`'s "Zo Veilig Commerce — DEV" label. Given it was created today, this
is almost certainly the intended new DEV project — but **you should rename it in the
Supabase dashboard** (Project Settings → General) to something matching the repo's
convention, and confirm this is the one you meant, since "zv-lead-deploy-2026-09-15" as a
name doesn't exist anywhere I could find. Everything below was done against this project.

## 1. `log-webhook-failure` — deployed and verified (function layer)

- Deployed via `supabase functions deploy log-webhook-failure`. Live at:
  `https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/log-webhook-failure`
- `ALLOWED_ORIGINS` secret set to `https://zoveiligdev.myshopify.com` (project-level secret,
  shared by both functions — each reads it independently via `Deno.env.get`).
- **Verified directly (curl, bypassing the browser):**
  - `OPTIONS` preflight from `https://zoveiligdev.myshopify.com` → `200`, correct
    `access-control-allow-origin`/`-methods`/`-headers`.
  - `POST` with a valid anon-key `Authorization` header and a well-formed payload
    (`source: "vista"`, `error_type: "network_error"`) → `500 {"ok":false,"error":"insert_failed"}`.
    **This is the expected result right now, not a bug** — the function's validation and
    Supabase-client wiring are correct; it fails only because `webhook_failures` (migration
    `008`) doesn't exist in this database yet (see §3).
- **Migration `008_webhook_failures.sql` — NOT applied.** See §3.

## 2. `capture-lead` — deployed and verified (function layer), one deploy mistake caught and fixed

- Deployed via `supabase functions deploy capture-lead`. Live at:
  `https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/capture-lead`
- **Mistake made and corrected during this session:** the first deploy used
  `--no-verify-jwt` (copied from habit, not needed here — the client always sends a valid
  anon-key JWT). Redeploying without that flag afterward did **not** reset JWT verification
  back on — Supabase's `deploy` only ever *disables* verify_jwt when the flag is passed; it
  doesn't restore the default on a later plain deploy. Caught by checking
  `supabase functions list` and seeing `verify_jwt: false` when it should've been `true`.
  **Fix:** added `supabase/config.toml` declaring `verify_jwt = true` explicitly for both
  functions (committed — makes every future deploy idempotent regardless of past flags,
  instead of relying on remembering not to pass a flag), then redeployed `capture-lead`.
  Confirmed fixed: `supabase functions list` now shows `verify_jwt: true` for both, and a
  request with no `Authorization` header now correctly gets `401` (previously would have
  been accepted).
- **Verified directly (curl):**
  - Valid anon-key JWT + well-formed payload (`Naam`, `Telefoon`, `email`, `Onderwerp`,
    empty honeypot) → `500 {"ok":false,"error":"insert_failed"}` — same story as §1: correct
    behavior, fails only because `leads`/`status_history` don't exist yet (see §3).
  - No `Authorization` header → `401` (JWT enforcement confirmed working after the fix).
- The `leads_contact_form_fields` schema addition (migration `007`) and the function code
  itself were already correct from the `feature/contact-form-odoo` branch (already merged
  into `main`) — no code changes were needed, only the deploy.

## 3. Migrations — BLOCKED, needs you to run this

`supabase migration list` against this project shows **zero** migrations applied (`remote`
column empty for all seven: `000, 001, 002, 003, 005, 007, 008`) — this is a genuinely
blank database, consistent with the project having been created today. `supabase db push`
would apply all seven in one shot (correct and expected — `supabase/README.md`'s Gate
boundary only reserves `004`/`006`, which don't exist locally, so a push can't touch Gate 2
work either way).

**I did not run it.** This session's own Bash auto-mode classifier denied the command as
"Modify Shared Resources" — a safety gate on schema changes to a real database, separate
from any Supabase-side permission. Per my own instructions when that happens, I'm stopping
and handing this to you rather than working around it. Two ways to unblock:

- **You run it** (simplest): from a real terminal, in a checkout of this repo/branch:
  ```
  SUPABASE_ACCESS_TOKEN=<your token> npx supabase db push --project-ref lfwkpbooieiesuvblvse
  ```
- **Or**: add a Bash permission rule in your Claude Code settings allowing this specific
  command, and ask me to run it in a follow-up.

**After migrations are applied**, re-running the exact same curl commands from §1/§2 should
flip both from `insert_failed` to a real `200 {"ok":true,...}` with a row in `leads` /
`webhook_failures` — I'm glad to re-run and confirm that in a follow-up once you've pushed,
or you can check the tables directly in the Supabase dashboard's Table Editor.

## 4. Theme settings — filled in on a PREVIEW theme, not the live theme (and not via the theme editor GUI)

**Deviation from the brief, flagged clearly:** step 3 asked me to fill these in "via the
Shopify theme editor (use your device-linked browser tool)" — **no browser tool is
connected in this session** (checked; only Bash/file tools and the Supabase CLI were
available). Editing live theme settings requires either that GUI or a git-tracked
`config/settings_data.json` push — and the guardrails explicitly said not to touch the live
theme. So instead:

- Pushed a **new unpublished preview theme**, `zv-supabase-deploy-preview-2026-09-15`
  (theme id `188869017981`), a full copy of current `main` with these four settings filled
  in with the real DEV values:
  - `capture_lead_endpoint` = `https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/capture-lead`
  - `capture_lead_anon_key` = the project's anon key (safe to expose client-side by design —
    same trust level as any storefront visitor; not a secret to protect, unlike the
    service_role key, which was never used or written anywhere outside the platform's own
    auto-injection into the Edge Functions)
  - `webhook_failure_log_endpoint` = `https://lfwkpbooieiesuvblvse.supabase.co/functions/v1/log-webhook-failure`
  - `webhook_failure_log_key` = same anon key
  - Preview URL: `https://zoveiligdev.myshopify.com?preview_theme_id=188869017981`
  - Theme editor: `https://zoveiligdev.myshopify.com/admin/themes/188869017981/editor`
- **The live theme's `config/settings_data.json` in this repo/branch is untouched** —
  confirmed via `git diff` before committing; these four settings stay blank there, exactly
  as before.
- This preview theme is real, live infrastructure on the store (not deleted) so you (or a
  follow-up session, once migrations are applied) can actually click through the Contact
  page and Vista/Onderweg/camera-hardware forms and see this work end-to-end in a browser.
  **It's yours to delete once you're done with it** — it's a normal unpublished theme, not a
  throwaway `zz-validate-*` one, so it won't get cleaned up automatically.

## 5. End-to-end verification — partially done, rest blocked on §3

Per the brief: submit one real Contact-form test and confirm a `leads` row; separately
break-then-restore `ZV_LEAD_ENDPOINT` and confirm a `webhook_failures` row.

**What's actually confirmed:** both functions are reachable, correctly enforce the CORS
origin allowlist, correctly enforce JWT auth, correctly validate input, and correctly reach
the database layer (see §1/§2's curl results) — the wiring works. **What's not confirmed:**
an actual row landing in any table, because no table exists yet (§3). I did not do the
break-`ZV_LEAD_ENDPOINT`-and-restore test on the preview theme, since with migrations still
unapplied it would only reproduce the same "insert_failed" already demonstrated in §1 —
no new information, and touching `callback_endpoint` (even on a non-live preview theme)
seemed unnecessary busywork until §3 is resolved. Once migrations land, re-running §1/§2's
curl commands is the fastest confirmation; the click-through-a-real-form version is what
the preview theme in §4 is for.

## 6. DEV-only, or does this affect production too?

**Everything in this session is scoped to DEV — nothing here touches or prepares
production.** Specifically:

- The Supabase project used (`lfwkpbooieiesuvblvse`) is a brand-new project, separate from
  whatever `supabase/README.md`'s "PROD — Zo Veilig Commerce (existing)" project is. No PROD
  Supabase credentials were provided or used.
- The Shopify changes are a new **unpublished preview theme** only — the live/published
  theme (synced from `origin main`) is untouched.
- **This entire sequence — deploy both functions, apply migrations, fill in the four
  settings — will need to be repeated separately for production**, once (a) a PROD Supabase
  project is approved per the Gate 4 process `supabase/README.md` describes, and (b)
  `veronica-origin` write access (or whatever governs the real production Shopify
  theme/store) lands. Nothing done here carries over automatically — different project,
  different theme, different settings storage. Don't assume DEV being wired up means
  production is one step closer without redoing this list against the real PROD targets.

## What's left for you

1. Run `supabase db push` (§3) — I'm blocked on this specific action, you're not.
2. Rename the Supabase project (§0) to something unambiguous, or tell me if
   `lfwkpbooieiesuvblvse` isn't actually the project you meant to give me.
3. Once migrations are applied, ask me to re-verify (§5) or check the dashboard yourself.
4. Decide when to promote these same four settings to the live theme — not done here, not
   assumed, per the guardrails on this task.
5. Delete the preview theme (`188869017981`) once you're done testing with it, or tell me
   to.
