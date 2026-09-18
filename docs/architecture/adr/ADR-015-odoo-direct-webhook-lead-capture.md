# ADR-015: Odoo direct-webhook lead capture (exception to ADR-004)
- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Thijs, platform team

## Context
ADR-004 deferred all Odoo dependency to Phase 2. In practice, Vista,
camera-hardware, and Veilig Onderweg already send leads directly to
Odoo's Automation Rule webhook, and Contact now does too (2026-09-16)
— this happened piecemeal, form by form, without ever being recorded
as a decision.

## Decision
Direct client-side POSTs to the Odoo Automation Rule webhook are an
approved Phase 1 exception for lead-capture forms specifically,
layered on top of (not replacing) the Supabase capture-lead pipeline
ADR-004 established. Full ERP integration (two-way sync, order/invoice
data, etc.) remains deferred to Phase 2 as ADR-004 says.

## Consequences
Lead data now exists in two systems for some forms (Supabase +
Odoo). Odoo's Automation Rule record_getter needs to stay manually in
sync with whatever fields each form sends, until Phase 2 replaces this
with a proper integration.

## Related
ADR-004
