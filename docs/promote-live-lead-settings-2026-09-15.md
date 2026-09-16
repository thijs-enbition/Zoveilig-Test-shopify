# Delete DEV test rows + promote lead-capture settings to the live theme (2026-09-15)

**Status: both parts complete and verified.**

## Part 1 — Test rows deleted from DEV Supabase (`lfwkpbooieiesuvblvse`)

Selected first, deleted by exact primary key (not the original text match, to be maximally
scoped), then confirmed each table is empty afterward:

| Table | Row deleted | Verified empty after |
|---|---|---|
| `public.leads` | `id = 16e87384-4954-4415-8226-6676d3fdade2` (`lead_reference = LEAD-20260915-047620`, `email = deploy-verify-postmigration@example.invalid`) | `count(*) = 0` |
| `public.status_history` | `id = 0bfcd957-ae0f-49e0-90ab-8996d48f6892` (the one row referencing the deleted lead) | `count(*) = 0` |
| `public.webhook_failures` | `id = 048a197b-cad8-4cec-bb87-2e538bca3e02` (`error_message = post-migration verify`) | `count(*) = 0` |

All three tables held exactly one row each before this (the verification rows from the
previous session) — deleting by primary key after a SELECT confirmed there was nothing else
to accidentally catch. All three are now genuinely empty, not just missing the named rows.

## Part 2 — Settings promoted to the live theme

**Live theme identified:** `Zoveilig-Test-shopify/main`, id **`188704719229`**, role `live`
(confirmed via `shopify theme list`, not assumed from the name) — distinct from the
`zv-supabase-deploy-preview-2026-09-15` preview theme (`188869017981`) from the prior
session, which was untouched by this task.

**Sequence used (exactly as specified, no full theme push at any point):**

1. `shopify theme pull --theme 188704719229 --only config/settings_data.json` into a scratch
   directory (**not** this git checkout) — the live theme's actual current settings, not
   git's copy.
2. **Diffed the pulled file against this repo's committed `config/settings_data.json`
   first, before changing anything**: identical except for Shopify's auto-generated
   "do not edit" comment header that every pull adds. **No undocumented drift this time** —
   unlike the pattern this repo has seen before, live and git agreed going in.
3. Patched exactly four keys into the pulled file, same values as the preview theme from
   the prior session (same DEV Supabase project, `lfwkpbooieiesuvblvse`):
   `capture_lead_endpoint`, `capture_lead_anon_key`, `webhook_failure_log_endpoint`,
   `webhook_failure_log_key`. Validated the result still parses as JSON and that only these
   four keys were added (118 preset keys total, matching the original plus exactly 4).
4. `shopify theme push --theme 188704719229 --only config/settings_data.json --nodelete
   --allow-live` — scoped to this one file, `--allow-live` required because this session is
   non-interactive and Shopify's CLI otherwise refuses to push to a live theme without an
   interactive confirmation prompt.
5. **Verified after, independently**: pulled `config/settings_data.json` from the live theme
   again into a fresh scratch directory and diffed it against the exact file pushed in step
   4 — **zero difference**. Separately diffed the post-push file against the original
   pre-push pull from step 1 — the only lines that differ are the four intended keys added.
   Nothing else moved.

**The four live values now match the preview theme exactly** (same DEV Supabase project —
this is still DEV-project credentials wired into the live *Shopify* theme, which is
`zoveiligdev.myshopify.com`, this repo's only real store; there is no separate production
Shopify store today per `CLAUDE.md`. A future PROD *Supabase* project, once one exists per
`supabase/README.md`'s Gate 4, would need these same four values swapped to its own — not
done or assumed here).

## Smoke test — blocked by storefront password, here's what to check yourself

**Could not complete the "submit the real Contact form" check.** No browser tool is
available in this session, and the storefront itself is password-protected —
`curl https://zoveiligdev.myshopify.com/pages/contact` returns a `302` to `/password`
regardless of theme settings, so even a headless HTML fetch to visually confirm the setting
rendered into the page is blocked without the storefront password (not asked for; didn't
assume it was fine to request without checking first — tell me if you'd like me to try that
route instead).

**What to check yourself, in order:**
1. Open `https://zoveiligdev.myshopify.com/pages/contact` (enter the storefront password),
   view source or devtools, and confirm the form carries non-empty
   `data-capture-lead-endpoint` and `data-capture-lead-key` attributes pointing at
   `lfwkpbooieiesuvblvse.supabase.co`.
2. Submit the form with an obviously-marked test entry (e.g. name "LIVE THEME TEST — safe
   to delete", a `.invalid`-domain email so nothing real gets contacted).
3. Confirm success in the UI (no `cn-err-server` error).
4. Check the Supabase dashboard's Table Editor for `public.leads` on project
   `lfwkpbooieiesuvblvse` — a new row should appear with your test name and a
   `contact_requested` status, plus a matching `status_history` row.
5. Delete that row afterward the same way Part 1 did, if you want the table to start clean
   again — or ask me to, and I'll select-then-delete by primary key the same way.

I'm glad to also do the Vista/camera-hardware/Onderweg equivalent (confirm they still work
and that a deliberately-broken `ZV_LEAD_ENDPOINT` now logs to `webhook_failures`) once you
either share the storefront password for a curl-based check or confirm you've clicked
through yourself.
