# ADR-009: Email and phone are not globally unique
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
One email or phone number can legitimately belong to several service recipients, households, packages or contracts.

## Decision
No global unique constraint on email or phone. Values are normalised and indexed for matching. Leads are matched by `lead_reference` → `journey_id` → normalised email/phone; ambiguous matches route to manual review and are never auto-merged.

## Consequences
No wrong merges of distinct people; some fragmentation risk, handled by the manual-review path.

## Related
ADR-010
