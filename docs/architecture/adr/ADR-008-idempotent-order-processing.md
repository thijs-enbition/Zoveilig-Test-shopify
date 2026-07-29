# ADR-008: Idempotent paid-order processing
- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Lead architect, platform team

## Context
Payment webhooks retry and can arrive out of order; duplicates would corrupt financial data.

## Decision
`commerce_orders.shopify_order_id` is unique (order anchor) and `commerce_order_lines (commerce_order_id, product_id)` is unique (line anchor). Processing upserts and advances status forward-only.

## Consequences
Safe retries with no duplicate orders/lines. Assumes one aggregated line per product; a `source_line_key` would be introduced only if that assumption changes.

## Related
ADR-012
