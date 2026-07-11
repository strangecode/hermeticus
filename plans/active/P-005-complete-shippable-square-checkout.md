# P-005 – Complete shippable Square checkout

## Purpose

Customers can see and pay a predictable shipping charge, must provide a shipping address on Square, and receive accurate confirmation copy. The shop can fulfill paid orders through Square Orders Manager without storing customer addresses on Hermeticus.

## Context and Orientation

`integrations/square-catalog-worker/src/index.js` creates Square payment links after live inventory validation. `assets/js/main.js` redirects buyers to Square and handles the return message. Square creates a `SHIPMENT` fulfillment when `ask_for_shipping_address` is enabled, but the current request has no shipping fee and the runbook does not explain manual fulfillment.

## Unknowns

- Known knowns: Square supports a fixed `checkout_options.shipping_fee`; the shop is in Ashland, Oregon; checkout uses USD.
- Known unknowns: no existing shipping rate or carrier account is configured.
- Unknown unknowns: production checkout behavior can differ from Square Sandbox.
- References: Square Checkout API documentation confirms that shipping-address collection creates a `SHIPMENT` fulfillment and that `shipping_fee` is a separate checkout option.
- Assumptions carried forward: charge a configurable $5.00 flat rate for US orders; disclose Square's lack of a country allowlist; use Square Orders Manager as the operational fulfillment system; do not retain addresses or order state in Hermeticus.

## Scope

Include a required Worker shipping-fee configuration, Square request construction, storefront disclosure and confirmation copy, automated tests, deployment instructions, architecture and decision records, Worker deployment, and production verification. Exclude carrier APIs, destination-based rates, a second order database, customer accounts, and automated fulfillment updates.

## Deliverables

- Checkout charges $5.00 US shipping, discloses the country policy, and requires the buyer's shipping address.
- Missing or invalid shipping configuration fails closed before Square checkout creation.
- Storefront copy discloses the rate and accurately describes the post-payment state.
- The runbook explains how to find, ship, and complete paid orders in Square.
- Tests cover the happy path and every new configuration error path.

## Interfaces and Dependencies

- `integrations/square-catalog-worker/src/index.js`
- `integrations/square-catalog-worker/test/catalog-worker.test.js`
- `integrations/square-catalog-worker/wrangler.toml`
- `_includes/square-catalog.html`
- `assets/js/main.js`
- `docs/square-catalog.md`
- `docs/architecture.md`
- `docs/decisions.md`
- Square Checkout API and Cloudflare Workers

## Plan of Work

1. Add failing Worker tests for a fixed shipping fee and invalid configuration.
2. Validate `SHIPPING_FEE_CENTS` and include a USD `shipping_fee` in `CreatePaymentLink` while preserving address collection.
3. Add concise, accessible shipping disclosure and correct the post-checkout message.
4. Document the manual Square fulfillment workflow and the flat-rate decision.
5. Run Worker tests, Jekyll build, focused browser checks, diffs, and repository safety checks.
6. Deploy the Worker, verify production checkout behavior without completing a charge, then commit the finished repository changes on `main`.

## Validation and Acceptance

- `npm test --prefix integrations/square-catalog-worker` passes, including red-first tests for missing, malformed, zero, and over-limit fees.
- `bundle exec jekyll build` completes without warnings.
- `/books/` shows the $5.00 flat-rate disclosure at desktop and mobile widths and remains keyboard-readable.
- A production payment link shows a $5.00 shipping line and requires a shipping address. Do not submit payment during automated verification.
- The Worker deploy succeeds and the repository remains free of secrets and unrelated changes.

## Idempotence and Recovery

Worker deployment is repeatable from the same commit. If validation fails, do not publish repository changes. Roll back the Worker by redeploying the previous known-good version. Change the rate by updating `SHIPPING_FEE_CENTS` and redeploying.

## Open Questions

None. The user delegated the implementation choices, and the fixed-rate assumption minimizes operational burden.

## Task Progress

- [x] Initial planning and Square contract review.
- [x] Red-first Worker tests.
- [x] Worker and storefront implementation.
- [x] Operational and architectural documentation.
- [x] Local and browser validation.
- [x] Worker deployment and production verification.
- [x] Commit on `main`.

## Outcomes

- A flat per-order fee is deliberately preferred over a carrier integration because the catalog has no reliable package weights and the shop needs a low-maintenance workflow.
- Plan review confirmed that shipping validation belongs at the start of checkout so catalog reads remain independent and misconfigured checkout fails before contacting Square.
- Five new tests failed against the previous checkout behavior and all Worker tests passed after the shipping implementation.
- Jekyll built successfully in the maintained Docker image, and browser checks confirmed the disclosure stays within the cart at desktop and mobile widths.
- Cloudflare OAuth succeeded; the authenticated login exposed multiple accounts, so `wrangler.toml` now pins the non-secret Hermeticus Bookshop account ID.
- Production checkout showed the correct $5.00 shipping line and required address fields, but also exposed Square's global country selector. Square has no Checkout API country allowlist, so the US-only policy is now disclosed on both checkout surfaces and must be verified during fulfillment.
- Square stripped policy text from a custom field that resembled its built-in order-notes label. The field is now a required, explicit `YES` confirmation instead of optional notes.
- Production Worker version `ce4de605-3879-4a06-97c8-542eb6c7b413` rendered the $5.00 shipping charge, required US-only confirmation, required shipping address, and correct order total without submitting payment.
