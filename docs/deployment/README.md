# Deployment

## Environments

| Environment | Store | Branch |
|---|---|---|
| Development | `zoveiligdev.myshopify.com` | any, via `shopify theme dev` |
| Staging | `*.myshopify.com` unpublished theme | `feature/*` |
| Production | published theme | `main` |

## Branch to theme

Shopify's GitHub integration connects one branch to one theme. `main` maps to the published theme;
feature branches map to unpublished preview themes.

Behaviour to respect:

- Sync is two way and cannot be disabled.
- There are no merge conflict alerts. Editing the same file in the Theme Editor and in Git can
  silently overwrite one side.
- Rule: **code in Git, merchant content in the Theme Editor.**
- `config/settings_data.json` will churn from editor edits. Do not hand edit it mid session.

## Prerequisite

The integration only recognises a branch whose **root** is a theme. This repository is structured
that way, which is why the theme sits at the root rather than in a subfolder.

## DNS cutover to zoveilig.nl

Not yet performed. Everything is built against the staging URL. Roughly thirty minutes of work
plus propagation:

1. Add `zoveilig.nl` in Shopify, follow the DNS instructions.
2. Wait for propagation.
3. Set it as the primary domain.
4. Bulk import the legacy URL to new URL 301 redirects.
5. Verify the domain in Meta Business Manager (TXT).
6. Verify in Google Search Console (TXT), submit the sitemap.
7. Update any ad final URLs still pointing at `myshopify.com`.
8. Smoke test: GTM fires, GA4 realtime, Meta test events.

Nothing else depends on DNS. Tag identifiers are domain agnostic.
