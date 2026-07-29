# ADR-002: Shopify is not the CRM
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
Shopify is strong at storefront, checkout and payment but weak as an operational CRM/ERP (limited relational modelling, no bill-of-materials, no operational workflow states).

## Decision
Shopify owns the customer experience and the sale only. Operational and lead/CRM data live in Supabase.

## Consequences
Clear boundary; the storefront passes only references via cart attributes; operations are not locked into a system we do not control.

## Related
ADR-003, ADR-012
