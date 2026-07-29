# ADR-003: Supabase owns operational data
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
We need relational integrity, constraints, transactions, row-level security, SQL reporting and a secure server-side boundary over leads, selections, orders, lines and audit.

## Decision
Supabase Postgres is the operational system of record; Edge Functions (with the service role) are the only write path.

## Consequences
Deny-by-default RLS; storefront never holds the service role; reporting is served by read-only views.

## Related
ADR-002, ADR-005, ADR-007
