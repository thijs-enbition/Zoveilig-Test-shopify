# ADR-004: Odoo deferred to Phase 2
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
Introducing ERP now would add scope, cost and risk before the commerce journey is proven.

## Decision
Phase 1 ends in a manual operational handover. Every table carries `odoo_*` fields so ERP is a forward-compatible extension, not a rewrite.

## Consequences
No Odoo dependency in Phase 1; handover is manual in the interim; Phase 2 maps cleanly onto the pre-wired fields.

Note: ADR-015 carves out an exception for lead-capture forms, which POST directly to an Odoo
webhook in Phase 1 — see ADR-015 for scope and rationale.

## Related
ADR-011, ADR-012, ADR-015
