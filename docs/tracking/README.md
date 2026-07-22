# Tracking

## Two conversion moments

| | Moment A | Moment B |
|---|---|---|
| Where | Shopify confirmation page | Odoo stage "Contract Signed" |
| Value | Amount Shopify actually collects today | Indicative contract value |
| Sent as | GA4 purchase, Meta, Google Ads | Offline conversion upload |
| Bidding | Leading indicator only | **Primary optimisation target** |

The purchase value must equal what Shopify collected. Never send the activation fee alone.
`monthlyRecurringPrice` and `indicativeContractValue` travel as separate parameters.

## Click identifier persistence

Offline conversions upload weeks after the click, so the identifier must survive on the order:

1. Capture `gclid`, `fbclid` and `utm_*` on entry, persist for the session.
2. Write them to Shopify cart and order note attributes so they reach Odoo.
3. Keep the Shopify order number identical to the Odoo order number.
4. At Moment B, export identifier, order number, timestamp and value.
5. Fall back to Enhanced Conversions for Leads when the click id is lost.

## Personal data handling

`assets/zv-measurement.js` normalises (trim, lowercase) and SHA-256 hashes email in the browser.
**Only the hex digest may leave the browser.** Raw email must never reach the dataLayer, a tag or
the console. Hashing fails closed on a non-secure context rather than falling back to plaintext.

## Consent

AVG. Four categories: Necessary (always on), Analytics, Marketing, Personalization. Default is
**denied** before interaction. Consent is driven through Shopify's Customer Privacy API so one
action governs the theme, Web Pixels and checkout together.

Consent Mode v2 mapping: Analytics to `analytics_storage`; Marketing to `ad_storage`,
`ad_user_data` and `ad_personalization`.

## Open

The Odoo treatment of the 1.5x prepayment determines the contract value. Until confirmed, the
indicative contract value is computed both ways and Moment B remains blocked.
