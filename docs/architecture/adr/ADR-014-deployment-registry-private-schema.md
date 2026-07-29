# ADR-014: Deployment version registry in a private schema
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
Every production deployment must be identifiable by schema, migration, Edge Function and Shopify integration version.

## Decision
`internal.deployment_registry` (private schema; RLS enabled; `anon`/`authenticated` revoked; not Data-API exposed) records one row per promotion with versions and the git SHA.

## Consequences
Auditable deployments tied to source control; the registry is never exposed to the storefront and is written by deployment tooling only.

## Related
ADR-001, ADR-013
