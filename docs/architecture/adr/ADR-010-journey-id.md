# ADR-010: journey_id for anonymous-to-known correlation
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
We must tie an anonymous visitor to a later known lead and paid order, across page loads and into checkout, without using it as authentication and without embedding PII.

## Decision
A first-party `journey_id` is created on first interaction, stored on `leads` (partial-unique when present), and carried into Shopify cart/order attributes.

## Consequences
Cross-session correlation that degrades gracefully (fallback to email/phone matching if browser storage is cleared).

## Related
ADR-009
