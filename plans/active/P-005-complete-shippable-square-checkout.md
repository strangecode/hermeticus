# P-005 – Complete shippable Square checkout

## Purpose

Customers provide a shipping address and pay a predictable shipping charge calculated from the live Square catalog. Ordinary books need no weight setup, light products can ship free, and rate changes require editing one JSON file and redeploying the Worker.

## Unknowns

- Square's public Catalog API does not expose the Dashboard's native shipping-weight field. Use a seller-visible `Shipping weight (lb)` number custom attribute, which is editable in Square Dashboard and returned by the API.
- A variation-level custom weight overrides an item-level value. Missing, negative, or malformed values become `null` so checkout charges the safer per-item rate.
- Square checkout accepts one calculated shipping service charge. A zero-dollar order sends an explicit `Free shipping` charge so checkout names the result clearly.
- Rates are USD-only and destination-independent. International orders remain possible and are canceled manually by the shop.

## Scope

Include compact catalog weights, JSON rate configuration and validation, per-item/weight/mixed-cart calculation, free shipping, Square request construction, storefront disclosure, automated tests, runbook and architecture updates, Worker deployment, and production verification. Exclude carrier APIs, destination validation, a second item database, customer accounts, and automated fulfillment updates.

## Deliverables

- `GET /catalog` returns `w` in pounds or `null` for every item.
- Checkout excludes items at or below 0.1 lb from shipping, applies the configured per-item or weight rule, and uses the higher candidate for mixed carts.
- Free-shipping orders send a zero-dollar `Free shipping` charge; paid shipping uses the calculated amount and neither path has a custom confirmation field.
- A validated JSON file is the only code-side source of shipping rates.
- README instructions explain rate edits and Square weight setup; durable docs describe the API and rationale.

## Interfaces and Dependencies

- `integrations/square-catalog-worker/shipping-rates.json`
- `integrations/square-catalog-worker/src/index.js`
- `integrations/square-catalog-worker/test/catalog-worker.test.js`
- `_includes/square-catalog.html`
- `README.md`
- `docs/square-catalog.md`
- `docs/architecture.md`
- `docs/decisions.md`
- Square Catalog, Inventory, and Checkout APIs; Cloudflare Workers

## Plan of Work

1. Add red-first tests for weight serialization, configuration errors, every rate boundary, free shipping, weighted carts, mixed carts, and Square payloads.
2. Add and validate `shipping-rates.json`, extract the Square custom weight, and calculate checkout shipping from current catalog data.
3. Remove the country confirmation, preserve address collection, and update storefront copy.
4. Update the human runbook, stable architecture, ADR ledger, and progress record.
5. Run Worker tests, the Jekyll build, focused source checks, and repository safety checks.
6. Deploy the Worker and verify production catalog and checkout behavior without completing a charge, then commit the finished repository changes on `main`.

## Validation and Acceptance

- `npm test --prefix integrations/square-catalog-worker` passes and each handled configuration error has a test.
- `bundle exec jekyll build` completes without warnings.
- `/books/` accurately says shipping is calculated at checkout and does not promise US-only enforcement.
- Production `/catalog` includes `w`; a checkout link collects an address, has no `YES` field, and charges the expected configured rate.
- The repository remains free of secrets and unrelated changes.

## Idempotence and Recovery

Worker deployment is repeatable from the same commit. Roll back by redeploying the previous known-good Worker version. Change rates in `shipping-rates.json`, run tests, and redeploy. A missing custom weight safely falls back to per-item shipping.

## Task Progress

- [x] Plan review and Square contract research.
- [x] Red-first Worker tests.
- [x] Worker, configuration, and storefront implementation.
- [x] Operational and architectural documentation.
- [x] Local validation.
- [x] Worker deployment.
- [ ] Production verification.
- [x] Commit on `main`.

## Outcomes

- Square-reviewed documentation confirms that the native Dashboard weight is unavailable in the Catalog API; the seller-visible catalog custom attribute is the supported bridge.
- The calculation treats only weights from 0 through 0.1 lb as free. Invalid negative weights fall back to per-item shipping instead of accidentally granting free shipping.
- The expanded suite fails against the flat-rate implementation because the new calculation exports and behavior do not yet exist.
- The implementation versions the catalog cache key so existing cached payloads without `w` cannot survive deployment.
- Fourteen Worker tests now pass, including all quantity tiers, threshold boundaries, the requested mixed-order example, free-only checkout, trusted weight extraction, and unsafe-money rejection.
- Wrangler bundled the JSON module successfully, and the Dockerized Jekyll build completed. Host Ruby lacks the locked Bundler version, so the maintained Docker environment supplied the site build.
- Cloudflare deployed Worker version `d962bbad-8931-4e0a-91dd-62f9efc9acb2`. The required live HTTP smoke test is still pending because the execution environment rejected the outbound verification command after reaching its approval usage limit.
