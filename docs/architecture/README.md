# Architecture

This directory documents **two** architectures that make up the platform. Start here.

| Architecture | What it covers | Entry point |
|---|---|---|
| **Supabase Commerce** (backend) | Lead capture, attribution, orders, operational handover, audit, reporting, ERP‑readiness | [`zo-veilig-commerce-architecture.md`](./zo-veilig-commerce-architecture.md) |
| **Storefront / theme** (Shopify) | Online Store 2.0 theme: layer model, sections/blocks, pricing config | [see below](#storefront--theme-architecture-shopify) |

---

## Supabase Commerce architecture (backend)

The operational data platform (Supabase Postgres + Edge Functions) that owns leads, package selections, commerce orders and audit. Repository‑first: `Git → migrations → DEV → Production`.

- **[Reference architecture](./zo-veilig-commerce-architecture.md)** — the full document: executive summary, principles and non‑negotiable guardrails, ERD, customer journey / data flow, solution architecture, table + data ownership, decisions, schema, roadmap, risk assessment and enterprise review.
- **[Architecture Decision Records](./adr/)** — 14 ADRs (`ADR‑001 … ADR‑014`) with an [index](./adr/README.md).
- **[Diagram sources](./diagrams/)** — Mermaid `.mmd` for the ERD, customer journey, solution architecture and roadmap.
- **[Glossary](./glossary.md)** — one‑line definitions of every key term.
- **Migrations (source of truth):** [`../../supabase/migrations/`](../../supabase/migrations/) — see [`../../supabase/README.md`](../../supabase/README.md) for the gate boundary.
- **Related operational docs:** [`../operations/`](../operations/), [`../security/`](../security/), [`../integrations/`](../integrations/), [`../roadmap/`](../roadmap/).

---

## Storefront / theme architecture (Shopify)

### Layer model

```
layout/theme.liquid          shell, header and footer section groups
  └── templates/*.json       page composition (JSON, Online Store 2.0)
        └── sections/*.liquid  reusable modules with schema
              └── blocks       repeatable, merchant editable content
                    └── snippets  shared markup
```

### Rules

1. Nothing customer-visible is hardcoded. Everything is a section or block setting.
2. Reuse Dawn sections where one fits; build new only where Dawn has no equivalent.
3. Custom CSS is namespaced (for example `.zv-kc`) so it cannot collide with Dawn.
4. Section settings in a JSON template are shared by every page using it. Pages needing
   distinct content get their own template.

### Custom components

| File | Purpose |
|---|---|
| `assets/zv-base.css` | Brand design tokens (colour, type, spacing, focus) |
| `assets/zv-kc.css` | Kenniscentrum components, ported from the design pack |
| `assets/zv-measurement.js` | dataLayer init, email normalise and SHA-256 |
| `sections/kc-hero.liquid` | Kenniscentrum hero, chips and stats as blocks |
| `sections/kc-bridge.liquid` | Bridge into the Keuzehulp |
| `sections/kc-cta-band.liquid` | Closing CTA band |
| `templates/page.kenniscentrum.json` | Kenniscentrum hub composition |

### Pricing configuration

`pricing/pricing.config.json` holds inputs only. `scripts/build_pricing.py` derives every value
once and writes `snippets/zv-pricing.liquid`. No page may compute or hardcode a price.

Derived values:

```
initialCommitmentAmount = monthlyRecurringPrice x 1.5
initialPaymentDueToday  = activationPrice + initialCommitmentAmount
indicativeContractValue = activation + commitment + remaining recurring
```

Integer cents with ROUND_HALF_UP throughout.

### Known constraint

A fully custom checkout requires Shopify Plus. On a standard plan the designed three step
checkout is implementable up to `/afrekenen`, after which Shopify's own checkout takes over.
