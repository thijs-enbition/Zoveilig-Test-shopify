# Live theme ↔ `origin/main` sync check (2026-09-16)

Process/ops question, not a code fix — no pushes or deploys were performed while
gathering this. Findings only, for Thijs to decide what to do with.

## 1. Which theme is live

`shopify theme list --environment zoveiligdev`:

| name | id | role |
|---|---|---|
| **Zoveilig-Test-shopify/main** | **188704719229** | **live** |

The CLI's `theme list` (JSON or table) does not expose an `updated_at` timestamp for
themes — that's not a field the Shopify CLI's theme-list query returns. Staleness below
is instead established by content-matching pulled files against git history, which turns
out to be far more precise anyway.

`origin/main` HEAD at the time of this check: `a6047af` (2026-09-16 10:25:52 +0200,
merge of PR #52). Local checkout HEAD (`fix/robi-feedback-content-2026-09-11`) is
further back at `e8914ba` (2026-09-14) — irrelevant to this check, which compares the
*live theme* against `origin/main`, not against the local branch.

## 2. Per-file comparison — live theme vs. `origin/main`

Pulled directly from the live theme (`shopify theme pull --theme 188704719229 --only <file>`)
and diffed byte-for-byte against `git show <commit>:<file>` at each candidate commit to find
an exact match:

| File | Live theme matches commit | Commit date | Next commit for this file (on `origin/main`) | Lag |
|---|---|---|---|---|
| `sections/contact-page.liquid` | `ac10dbf` "Contact form: capture into Supabase leads via capture-lead Edge Function" | 2026-09-09 20:46 | `b477032` "Contact form: separate validation errors from server/network errors" (2026-09-09 21:02) | **~1 week** (missing the very next commit, from the same evening) |
| `sections/borg.liquid` | `0554fed` "Add BORG-certificering page section and template" | 2026-09-15 15:55 | `d460ffd` "fix: BORG page h1 uses clamp() like every other hero h1 in the theme" (2026-09-16 09:29) | **~21 hours** (missing one follow-up CSS fix) |
| `sections/zv-header.liquid` | `78489d9` "fix: relocate CTA into mobile drawer, resolving .sf-right overflow" | 2026-09-16 09:58 | — (this *is* the latest commit for this file on `origin/main`) | **none — fully current** |

`sections/borg.liquid` does exist on the live theme (added 2026-09-15), so it isn't
stale in the "predates Sep-15 entirely" sense the task flagged as the worst case — but
it's still missing the very next commit that touched it.

**The key finding is the shape of this table, not any single row**: three files sit at
three different, unrelated points on `origin/main`'s history — one from over a week ago,
one from yesterday afternoon, one from this morning. A working commit-triggered
auto-deploy would put every file at the *same* commit (whichever push last triggered it).
This pattern — each file pinned to whenever *it* was last individually touched — is the
signature of ad hoc, per-file manual pushes, not an atomic sync tied to `origin/main`'s
commit history.

## 3. Is Shopify's GitHub integration actually deploying `main` → live?

`.github/workflows/ci.yml` (line 3-4) states as a design assumption: *"Validation only.
This workflow never deploys... Deployment happens through the Shopify GitHub integration
(branch to theme)."* The live theme's name, `Zoveilig-Test-shopify/main`, matches the
auto-naming pattern Shopify's GitHub-connect feature uses (`<repo>/<branch>`), which is
evidence a GitHub↔theme connection was set up at some point.

But checking the GitHub side directly (repo is public, checked via the unauthenticated
GitHub API against `origin/main` HEAD `a6047af`):

- **Check-runs on HEAD**: only 2, both from our own CI (`Pricing integrity`,
  `Theme Check (Liquid lint)`) — no Shopify-originated check or status.
- **Commit status**: `"state": "pending"`, `"total_count": 0` — nothing has ever posted a
  status here.
- **Deployments API** (`/deployments`): empty array — no deployment records at all.

None of this alone proves the integration is disconnected (Shopify's GitHub theme
connection is a webhook-driven feature and isn't guaranteed to surface as a GitHub Check,
Status, or Deployment record). But combined with finding #2 — a live theme that is
demonstrably **not** at any single consistent commit of `origin/main` — the evidence
points the same way: **deploys are not currently landing automatically from `main`.**
Whatever gets the live theme its recent, current-looking files (like `zv-header.liquid`,
current as of this morning) is most plausibly manual `shopify theme push --theme
188704719229 --only <file>`, done selectively after specific fixes — matching the
per-file pattern in #2 and the manual-push workflow this repo's `CLAUDE.md` already
documents for *validating* changes (against a throwaway theme) before merging.

**This needs confirming in Shopify Admin** (Settings → Apps and sales channels →
Online Store → the live theme's connection details, or Admin → Online Store → Themes →
"⋯" on the live theme) — that's the one place that authoritatively shows whether a
GitHub branch connection exists and is active. I don't have Admin access to check that
page directly (see #4).

## 4. Does pushing to this theme need Admin permissions Thijs doesn't have?

Not something this check could establish conclusively without either (a) attempting an
actual push — out of scope, not done — or (b) opening Shopify Admin → Settings → Users
and permissions, which is exactly the access that's reportedly blocked.

What is confirmed: the current CLI session (authenticated as Thijs, via the normal
device-code login) can **read** the live theme without issue — `theme list` and
`theme pull --theme 188704719229` both succeeded. That only confirms read/theme-view
access, not write/publish. Shopify scopes theme **push** permission per-staff-account
under Settings → Users and permissions → "Themes" (None/View/Edit), separately from
general Admin access — so it's possible for the same blocker (no Admin access) to also
mean Thijs can't see or change his own Themes permission level, or it's possible his
account already has theme-edit rights independent of full Admin. Whoever *does* have
Admin access needs to check that page to say for certain.

## Bottom line

- The live theme is **not** kept in sync with `origin/main` on any predictable schedule —
  it's a patchwork of manual, per-file pushes from three different points in the last
  week.
- No independent evidence was found (via GitHub's public API) that an automatic
  `main` → live deploy is actually firing on recent pushes; the CI workflow's own comment
  assumes it should be, but the live theme's state contradicts that assumption.
- Whether a GitHub→theme connection is configured but stalled/misconfigured, or was never
  actually wired up despite the theme's `/main`-suffixed name, needs a look at Shopify
  Admin's theme connection settings — outside what CLI/API access here could confirm.
- Push permission on theme `188704719229` specifically is unverified; confirmed only that
  read access works for Thijs's current session.

No changes were made to any theme, repo file, or Shopify configuration during this check.
