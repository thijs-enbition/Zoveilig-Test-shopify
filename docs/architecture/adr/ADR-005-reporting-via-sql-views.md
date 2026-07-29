# ADR-005: Reporting via SQL views (read-only)
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
Business users and BI tools must never query raw operational tables (PII exposure, coupling, accidental load).

## Decision
Reporting is served by read-only `vw_*` views plus a dedicated read-only reporting role; base tables are never exposed to BI.

## Consequences
A stable, governed, PII-minimised contract; the schema can evolve behind the views. A reporting security review is required before the views are built (Gate 2).

## Related
ADR-003, ADR-007
