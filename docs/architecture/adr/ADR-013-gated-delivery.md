# ADR-013: Gated delivery (four approval gates)
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
A high-stakes commerce + PII integration needs controlled, reversible progress and no uncontrolled scope.

## Decision
Delivery proceeds through four gates — Gate 1 DEV foundation, Gate 2 server logic, Gate 3 Shopify DEV integration, Gate 4 production — with explicit sign-off between each.

## Consequences
Safe, reversible increments; gated migration files (`004_rpc`, `006_reporting_views` are absent until Gate 2) so a push cannot over-apply.

## Related
ADR-001, ADR-006
