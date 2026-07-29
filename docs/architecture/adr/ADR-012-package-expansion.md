# ADR-012: Package expansion via package_components + snapshots
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
A customer buys a "package", but operations must deliver and invoice its parts (hub, sensors, activation, recurring service).

## Decision
Expand the purchased package into `commerce_order_lines` via `package_components`, snapshotting SKU/name/price/type on each line.

## Consequences
Operational and finance detail is preserved and immune to later catalogue changes; storing only the package header would be insufficient.

## Related
ADR-008, ADR-002
