# VS Code extensions — audit (2026-09-16)

Documentation only. No extension was installed, enabled, or configured as part of this
task, and no `.vscode/` file was changed — this repo already has a committed
`.vscode/extensions.json` and `.vscode/settings.json`; both are reported below as-is.

## What's installed locally (per Thijs's screenshot)

Already installed:

- **Shopify Liquid** (official, publisher Shopify) — `Shopify.theme-check-vscode`. This is
  the same extension already recommended in this repo's `.vscode/extensions.json`.
- **Shopify Liquid Template Snippets** by Franky Lau — likely
  `killalau.vscode-liquid-snippets` on the marketplace (repo: `killalau/vscode-liquid-snippets`).
  Not currently listed in this repo's `.vscode/extensions.json`.
- **Shopify Content Schema** by Alireza Jahandideh — likely
  `Youhan.vscode-snippets-shopify-content-schema` on the marketplace. Not currently listed
  in this repo's `.vscode/extensions.json`.

Not yet installed: nothing else was reported as installed.

I could not independently verify the installed set from this session — the `code` CLI
(`code --list-extensions`) is not on `PATH` here — so the above is Thijs's screenshot,
not a machine-verified list. The two marketplace IDs for the Franky Lau and Alireza
Jahandideh extensions are a best-effort match by publisher/display name (via web search),
not confirmed against the actual installed extension IDs.

## `.vscode/extensions.json` — already exists, current contents

```json
{
  "recommendations": ["shopify.theme-check-vscode", "esbenp.prettier-vscode"]
}
```

This already recommends the one extension that matters most for this repo:
`Shopify.theme-check-vscode` ("Shopify Liquid" in the marketplace) — confirmed load-bearing
by repo content: **77 section files** under `sections/` use `{% schema %}` blocks, which is
exactly what this extension understands (Liquid syntax, schema JSON validation, and
`themeCheck.checkOnSave`, wired up in `.vscode/settings.json` below). `esbenp.prettier-vscode`
matches the JS/CSS formatter already configured in `settings.json`.

**No change is proposed to this file.** The two additional extensions Thijs has installed
locally (Franky Lau's snippets pack, Alireza Jahandideh's Content Schema snippets) are
editor conveniences (autocomplete/snippets) layered on top of what `theme-check-vscode`
already validates — reasonable personal additions, but not things this repo needs to assert
as team-wide recommendations. The repo has 51 locale files under `locales/` (both
`*.json` storefront strings and `*.schema.json` theme-editor strings) — no dedicated
i18n-focused extension is recommended for these today, and nothing in the current file set
suggests one is needed beyond what a JSON-aware editor already provides.

## `.vscode/settings.json` — current contents

```json
{
  "editor.formatOnSave": false,
  "[javascript]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[css]": {
    "editor.formatOnSave": true
  },
  "[liquid]": {
    "editor.defaultFormatter": "Shopify.theme-check-vscode",
    "editor.formatOnSave": true
  },
  "themeCheck.checkOnSave": true
}
```

No setting here disables, overrides, or weakens theme-check behavior — `themeCheck.checkOnSave`
is explicitly `true`, and Liquid's formatter is the Shopify extension itself. There is no
`themeCheck.ignoredFiles`, no lowered severity/`fail-level` setting, and no third-party Liquid
formatter shadowing it.

## Extensions vs. the CLI validation gate — no conflict, but one claim I could not confirm

I searched the full repo (no `package.json` exists here at all) and could not find any
reference to `@shopify/theme-check-node@3.29.0` as an installed dependency or pinned
version anywhere in this repo — not in a lockfile (none exists), not in `CLAUDE.md`, not in
CI. What the repo actually documents and runs as the gate is the **Shopify CLI**
(`shopify theme check --fail-level error`, `.github/workflows/ci.yml` line 30 — this
machine has Shopify CLI `4.8.0` installed globally), plus the pre-push manual step
`CLAUDE.md` requires under "Working rules for Claude Code on this repo": pushing to a
disposable unpublished theme (`shopify theme push --unpublished --theme "<throwaway>"`)
to catch what `theme check` misses (Shopify's stricter server-side Liquid validator).

Either way, the conclusion holds regardless of which exact tool/version gates pushes:
**editor extensions (the VS Code "Shopify Liquid" extension and its live linting) are a
convenience layer, not a substitute for the CLI validation step.** `themeCheck.checkOnSave`
in `.vscode/settings.json` runs the same underlying theme-check engine as the CLI, so in
practice its findings should agree with `shopify theme check` — but only the CLI step
(and, per `CLAUDE.md`, the throwaway-theme push before touching `origin main`) is the
actual gate. Nothing in `.vscode/settings.json` or `.vscode/extensions.json` changes,
bypasses, or duplicates that gate — it only surfaces the same warnings earlier, in-editor.

**Recommendation**: if `@shopify/theme-check-node@3.29.0` is meant to be a pinned CLI
dependency going forward, it isn't wired into this repo yet (no `package.json` exists to
pin it in) — worth confirming with Thijs separately whether that's a planned addition or a
reference to tooling that lives outside this repo.

## Not affected by any of this

No VS Code extension changes anything about:

- **Shopify Admin access** — the open question of whether Thijs's account has Admin/Themes
  push permission is a Shopify account-permissions matter, fully independent of the local
  editor. See `docs/live-theme-sync-check-2026-09-16.md` §4 for the current unresolved
  state (read access confirmed via the CLI; push/Admin access unconfirmed).
- **Storefront password-protection** — `zoveiligdev.myshopify.com` sits behind a storefront
  password wall that has blocked click-through/browser verification across multiple past
  sessions (see e.g. `docs/contact-form-fix-2026-09-16.md`, `docs/promote-live-lead-settings-2026-09-15.md`,
  `docs/contact-capture-lead-fix-2026-09-16.md`). This is a Shopify store setting, unrelated
  to the editor.

Note on tracking: a `docs/todo-tracker.md` file briefly existed on another branch
(`feature/package-addons-uitbreidingen-2026-09-16`) but was deliberately removed there
(commit `66560ab`, "that path isn't the real tracker") — the actual running to-do/repo-watch
list lives outside this git repo entirely. So neither open item above is tracked in a
`docs/todo-tracker.md` in this repo; they're documented in the dated docs referenced above,
and remain Thijs's to resolve in Shopify Admin, not something a VS Code extension change
addresses.
