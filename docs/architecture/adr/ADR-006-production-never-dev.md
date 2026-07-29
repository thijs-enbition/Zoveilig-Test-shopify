# ADR-006: Production is never the development environment
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
Building or testing against production risks customer data and change safety.

## Decision
Build and test on an isolated DEV project (test data, separate credentials). Production is touched only by reviewed migrations after gate sign-off, preceded by a read-only drift check.

## Consequences
Safer changes; a dedicated DEV project is required; promotion is deliberate and reviewed.

## Related
ADR-001, ADR-013
