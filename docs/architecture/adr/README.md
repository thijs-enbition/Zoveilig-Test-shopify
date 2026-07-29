# Architecture Decision Records (ADRs)

Short, dated records of each significant decision, with context and consequences.
The summary register also lives in the
[reference architecture](../zo-veilig-commerce-architecture.md#71-architecture-decision-record-adr-register).

| ADR | Decision | Status |
|---|---|---|
| [001](./ADR-001-git-source-of-truth.md) | Git is the source of truth | Accepted |
| [002](./ADR-002-shopify-not-crm.md) | Shopify is not the CRM | Accepted |
| [003](./ADR-003-supabase-owns-operational-data.md) | Supabase owns operational data | Accepted |
| [004](./ADR-004-odoo-deferred-phase-2.md) | Odoo deferred to Phase 2 | Accepted |
| [005](./ADR-005-reporting-via-sql-views.md) | Reporting via SQL views | Accepted |
| [006](./ADR-006-production-never-dev.md) | Production is never the dev environment | Accepted |
| [007](./ADR-007-rls-deny-by-default-edge-boundary.md) | Deny-by-default RLS + Edge Function boundary | Accepted |
| [008](./ADR-008-idempotent-order-processing.md) | Idempotent paid-order processing | Accepted |
| [009](./ADR-009-email-phone-not-globally-unique.md) | Email/phone not globally unique | Accepted |
| [010](./ADR-010-journey-id.md) | journey_id for anonymous-to-known correlation | Accepted |
| [011](./ADR-011-operational-handover-status-separate.md) | operational_handover_status separate | Accepted |
| [012](./ADR-012-package-expansion.md) | Package expansion via package_components | Accepted |
| [013](./ADR-013-gated-delivery.md) | Gated delivery (four gates) | Accepted |
| [014](./ADR-014-deployment-registry-private-schema.md) | Deployment registry in a private schema | Accepted |
