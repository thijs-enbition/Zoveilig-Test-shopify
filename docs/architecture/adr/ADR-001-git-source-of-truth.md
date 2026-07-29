# ADR-001: Git is the source of truth
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
Multiple environments (DEV, Production) risk schema drift, and treating a live database as the baseline hides changes and makes environments non-reproducible.

## Decision
The Git repository's version-controlled migration files are canonical. Changes flow one way: **Git → migrations → DEV → Production**. No production schema dumps are used as a baseline.

## Consequences
Every environment is rebuilt from source; schema changes are reviewed like code; drift is caught by a read-only comparison. A bootstrap baseline (`000_baseline.sql`) is hand-authored and kept in sync.

## Related
ADR-006, ADR-013, ADR-014
