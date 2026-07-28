-- 003_order_lines_idempotency.sql
-- Prevents duplicate package expansion on webhook retries.
-- ASSUMES one aggregated line per product per order (quantity_ordered = total qty).
-- If a future order legitimately needs two lines of the same product_id
-- (same SKU at different unit price/tax, per-unit personalisation, or a 1:1
--  Shopify line-item mapping for partial refunds), replace this with a
--  (commerce_order_id, source_line_key) unique index instead.

create unique index commerce_order_lines_order_product_key
  on public.commerce_order_lines (commerce_order_id, product_id);
