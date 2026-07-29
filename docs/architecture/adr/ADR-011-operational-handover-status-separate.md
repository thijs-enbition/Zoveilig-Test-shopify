# ADR-011: operational_handover_status separate from activation_status
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
Manual operational handover is a distinct real-world lifecycle from device activation.

## Decision
A dedicated `operational_handover_status` column (text + CHECK) separate from `activation_status`.

## Consequences
Clear, unambiguous operational state and a clean future Odoo mapping; no overloaded column conflating two processes.

## Related
ADR-004
