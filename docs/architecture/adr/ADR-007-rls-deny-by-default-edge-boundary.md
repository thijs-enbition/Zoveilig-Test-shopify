# ADR-007: Deny-by-default RLS + Edge Function boundary
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
The storefront must never hold a service-role key or write to protected tables directly.

## Decision
RLS is enabled on every table with no policies, so only the RLS-exempt service role accesses rows. All writes go through Supabase Edge Functions; no service-role key ever reaches the browser.

## Consequences
Strong security posture; `anon`/`authenticated` are denied by default; Edge Functions are the sole, auditable write path.

## Related
ADR-003, ADR-005
