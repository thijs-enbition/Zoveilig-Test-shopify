# ADR-007: Deny-by-default RLS + Edge Function boundary
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
The storefront must never hold a service-role key or write to protected tables directly.

## Decision
RLS is enabled on every table with no policies, so the Data-API roles `anon` and `authenticated` are denied all rows. Privileged roles (`postgres`, table owners, `service_role`, and any `BYPASSRLS` role) operate outside RLS; all application access goes through Supabase Edge Functions using `service_role`, and no service-role key ever reaches the browser.

## Consequences
Strong security posture; the storefront (which only ever uses `anon`) is denied by default; Edge Functions are the sole, auditable application write path.

## Related
ADR-003, ADR-005
