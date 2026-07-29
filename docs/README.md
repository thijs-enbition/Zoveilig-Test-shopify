# Documentation

Two architectures live here — the **Supabase Commerce** backend and the **Shopify storefront/theme**. Start at [`architecture/README.md`](./architecture/README.md), which indexes both.

**Fast links:** [Commerce reference architecture](./architecture/zo-veilig-commerce-architecture.md) · [ADRs](./architecture/adr/) · [Diagrams](./architecture/diagrams/) · [Glossary](./architecture/glossary.md)

| Folder | Contents |
|---|---|
| `architecture/` | **Both** architectures: the Supabase Commerce reference architecture (+ ADRs, diagrams, glossary) **and** the Shopify theme structure, section/block strategy and pricing configuration model |
| `operations/` | Operational runbooks: manual handover, ambiguous‑lead review, incident response (Gate 2/3) |
| `security/` | Reporting security review, threat model, secrets and GDPR/retention runbook (Gate 2) |
| `integrations/` | Integration specs: Shopify webhooks + cart attributes (Gate 3), Odoo mapping (Phase 2), analytics |
| `roadmap/` | Phase planning detail (Phases 1–6) |
| `tracking/` | Measurement plan, Moment A and Moment B, consent, dataLayer contract |
| `deployment/` | Branch to theme mapping, environments, DNS cutover runbook |
| `compliance/` | Internal accountability records (RoPA, DPAs, retention, DPIA) |

Commercial and marketing decisions are recorded in the Zo Veilig marketing OS repository
(`clients/zo-veilig/operating-system/decision-log/`). This folder covers the platform only.
