# zo-veilig-platform

Shopify storefront for **Zo Veilig B.V.** (zoveilig.nl): home security and connected care for
longer independent living in the Netherlands.

This repository is the **theme**. It is a Dawn-based Shopify Online Store 2.0 theme with the theme
directories at the repository root, which is what Shopify's GitHub integration requires for
branch-to-theme deployment.

---

## 1. Project overview

Zo Veilig sells three solution lines, each with monthly packages plus a one-off activation:

| Line | Route param | Packages | Status |
|---|---|---|---|
| Langer Thuis | `living` | Inzicht, Zeker, Beschermd | current working prices |
| Mijn Thuis | `security` | Alert, Protect, Vista | current working prices |
| Veilig Onderweg | `persoonlijk` | SOS, Zorg | unpriced, not purchasable |

**The commercial model is unusual and drives most of the architecture.** The online payment is not
the full sale:

```
Due today (Shopify)  = activationPrice + (monthlyRecurringPrice x 1.5)
Thereafter (Odoo)    = monthlyRecurringPrice, by SEPA, over a 36 month contract
```

Shopify collects only the amount due today. Odoo owns the contract, the SEPA mandate and every
recurring invoice. There are therefore two conversion moments:

- **Moment A**: online payment in Shopify. Value = amount actually collected today.
- **Moment B**: contract signed in Odoo. Uploaded to Google and Meta as an offline conversion.

Advertising optimises on **Moment B**, not Moment A.

### System boundaries

| Concern | Source of truth |
|---|---|
| Customer identity, CRM, invoicing, SEPA | **Odoo** |
| Auth, orders, payments, conversion | **Shopify** |
| Attribution (UTM, gclid, fbclid) | **Shopify**, never Odoo |
| Prices and contract duration | `pricing/pricing.config.json` |
| Product SKU | Odoo Internal Reference (Shopify SKU must match) |
| Order number | Shared key, identical in both systems |

---

## 2. Architecture

```
zo-veilig-platform/
├── assets/            theme CSS, JS, images
│   ├── zv-base.css        brand design tokens
│   ├── zv-kc.css          Kenniscentrum components (scoped .zv-kc)
│   └── zv-measurement.js  dataLayer init + email normalise/SHA-256
├── config/            theme + colour scheme settings
├── layout/            theme.liquid
├── locales/           translations (nl default)
├── sections/          kc-hero, kc-bridge, kc-cta-band, + Dawn sections
├── snippets/          zv-pricing.liquid (GENERATED, do not edit)
├── templates/         page.kenniscentrum.json, + Dawn templates
├── pricing/           pricing.config.json, pricing.schema.json
├── scripts/           build_pricing.py, check_pricing.py
├── docs/              architecture, tracking, deployment, compliance
└── .github/workflows/ CI validation
```

Shopify ignores non-theme directories (`docs/`, `scripts/`, `pricing/`, `.github/`), so they are
safe at the root.

### Pricing is configuration, not copy

**No template, section, snippet or analytics event may contain a literal price or contract
duration.** Values live in `pricing/pricing.config.json`, are derived once by
`scripts/build_pricing.py`, and are materialised into `snippets/zv-pricing.liquid`.

`scripts/check_pricing.py` enforces this and fails CI if any theme file carries a hardcoded price
or duration.

Money is handled as **integer cents** with `ROUND_HALF_UP`. Banker's rounding is rejected: 1.5 x
2495 must be 3743 (EUR 37,43), not 3742.

---

## 3. Local development

### Requirements

- Node.js 22.12 or higher
- Shopify CLI 4.x (`npm install -g @shopify/cli@latest`)
- Python 3.9 or higher (pricing scripts, standard library only)
- Git 2.28 or higher

### Run the theme

```bash
shopify theme dev --store zoveiligdev.myshopify.com
```

Opens a hot-reloading preview. The first run authenticates through the browser.

### Rebuild pricing after editing the config

```bash
python3 scripts/build_pricing.py    # regenerate snippets/zv-pricing.liquid
python3 scripts/check_pricing.py    # verify, exits non-zero on failure
```

### Lint

```bash
shopify theme check
```

---

## 4. Branch strategy

`main` is always deployable and maps to the published theme.

```
main                      production, published theme
├── feature/<name>        new sections or templates
├── fix/<name>            bug fixes
└── content/<name>        copy and settings only
```

Rules:

1. Never commit directly to `main`.
2. One branch per unit of work; keep them short-lived.
3. CI must be green before merge.
4. Rebase rather than merge to keep history linear.
5. Never commit secrets. `.env`, tokens and `shopify.theme.toml` are gitignored.

---

## 5. Deployment workflow

Shopify's GitHub integration maps **one branch to one theme**:

| Branch | Theme | Purpose |
|---|---|---|
| `main` | published theme | live storefront |
| `feature/*` | unpublished preview theme | review before merge |

Important behaviour:

- Sync is **two-way** and cannot be disabled. Theme Editor changes are committed back.
- There are **no merge-conflict alerts**. Editing the same file in the editor and in Git can
  silently overwrite.
- Therefore: **code in Git, merchant content in the Theme Editor.** Expect
  `config/settings_data.json` to churn from editor edits; do not hand-edit it during a session.

### Cutover to zoveilig.nl

DNS is not yet pointed. Everything is built against the `*.myshopify.com` staging URL. At cutover:
add the domain in Shopify, set it primary, install 301 redirects, verify the domain in Meta and
Google Search Console, update ad final URLs. See `docs/deployment/`.

---

## 6. Shopify CLI commands

| Command | Purpose |
|---|---|
| `shopify theme dev --store <store>` | Local hot-reloading preview |
| `shopify theme check` | Lint (Theme Check) |
| `shopify theme pull --store <store>` | Pull remote theme changes |
| `shopify theme push --store <store> --unpublished` | Push to a new unpublished theme |
| `shopify theme list --store <store>` | List store themes and IDs |
| `shopify theme share` | Create a shareable preview |
| `shopify auth logout` | Clear the CLI session |

Never `shopify theme push` directly to the published theme. Deployment happens by merging to
`main`.

---

## 7. Coding standards

### Liquid and Online Store 2.0

- **Nothing customer-visible is hardcoded.** Every string, image and link is a section or block
  setting so it is editable without a developer.
- Repeatable content uses **blocks**, never hardcoded loops.
- Reuse Dawn sections where one fits. Build new sections only where Dawn has no equivalent.
- Schema labels are in **Dutch**; the Theme Editor is a merchant-facing product.
- Section settings in a JSON template are shared by every page using that template. Pages needing
  distinct content get their own template.

### CSS

- Custom CSS is scoped (for example everything Kenniscentrum sits under `.zv-kc`) so it cannot
  collide with Dawn.
- Use design tokens from `zv-base.css`. Never hardcode a brand hex or font.
- Mobile-first. Component styles belong with their section.

### JavaScript

- Vanilla, no framework. Progressive enhancement: pages must work without JS.
- `defer` everything. Core Web Vitals are a launch requirement.
- Never log or transmit raw personal data. Emails are normalised and SHA-256 hashed in the browser,
  and only the digest may leave it.

### Copy

- **No em dashes or en dashes anywhere** in customer-visible text, including schema defaults. Use a
  comma, a period, a colon, "en"/"tot", or a middot.
- Dutch, gevoel-first tone. Never "surveillance", "controleren", "bewaken" or "abonnement verplicht".
- NAMI is presented as **géén camera**, framed as a feature.

### Accessibility

WCAG 2.1 AA: semantic HTML, keyboard navigation, visible focus states, alt text, and contrast
verified against the brand palette.

---

## 8. Status

Design is essentially complete (about 96 pages). The theme build has started: brand tokens, the
pricing configuration layer, measurement utilities, and the Kenniscentrum hero, bridge and CTA band.
Most templates are not built yet.

Open decisions that block finalisation are tracked in `docs/`. The most significant are the Odoo
treatment of the 1.5x prepayment, and whether checkout stays on standard Shopify (a fully custom
checkout requires Shopify Plus).

---

## Licence

Based on [Dawn](https://github.com/Shopify/dawn) (MIT), see `LICENSE.md`. All Zo Veilig brand
assets, content and custom code are proprietary to Zo Veilig B.V.
