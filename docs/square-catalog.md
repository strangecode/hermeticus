# Square Catalog Runbook

## Purpose

This document explains how to configure, deploy, validate, and roll back the live Square catalog integration used by `/books/`.

## What Lives Where

- Static site code: `/Users/q/src/hermeticus`
- Worker source: `integrations/square-catalog-worker/`
- Public worker URL reference: `_config.yml` as `square_catalog_api_base`
- Worker secret: `SQUARE_ACCESS_TOKEN` in Cloudflare

## Required Accounts and Inputs

- A Cloudflare account that can deploy Workers
- A Square seller account and developer app
- One Square access token with these permissions:
  - `ITEMS_READ`
  - `INVENTORY_READ`
  - `ORDERS_READ`
  - `ORDERS_WRITE`
  - `PAYMENTS_WRITE`
- The Square location ID that should drive both inventory checks and checkout creation

## Square Data Rules for V1

Each book intended for the website should:

- be active, not archived
- have exactly one sellable variation
- have a positive price on that variation
- have inventory tracking enabled at the chosen Square location
- have positive inventory if it should be visible online

Optional but recommended:

- a category
- one or more images
- a customer-facing description. If Square provides `description_html`, the
  website displays that formatted HTML after client-side sanitization.

Items with multiple variations are skipped by v1.

## Worker Configuration

`integrations/square-catalog-worker/wrangler.toml` stores non-secret defaults:

- `ALLOWED_ORIGINS`
- `account_id` for the Hermeticus Bookshop Cloudflare account
- `SQUARE_ENV`
- `CATALOG_TTL_SECONDS`
- `SQUARE_VERSION`
- `SQUARE_LOCATION_ID`
- `SHIPPING_FEE_CENTS`

Before deploy, set these values as needed:

- `ALLOWED_ORIGINS` should include `https://hermeticus.org`
- `SQUARE_ENV` should be `production` unless testing against Square sandbox
- `SQUARE_LOCATION_ID` must be set for the location used by the shop
- `CATALOG_TTL_SECONDS` defaults to `300`
- `SHIPPING_FEE_CENTS` is the flat per-order shipping charge in US cents and is currently `500` ($5.00). Checkout rejects missing, zero, malformed, or unexpectedly high values before contacting Square.

The secret token must never be committed:

```bash
npx wrangler secret put SQUARE_ACCESS_TOKEN \
  --config integrations/square-catalog-worker/wrangler.toml
```

## Local Setup

From the repo root:

```bash
npm install --cache /var/folders/sd/sqyq8bqd6bj1vjh9v7f_5ddc0000gp/T/hermeticus-npm-cache \
  --prefix integrations/square-catalog-worker
npm test --prefix integrations/square-catalog-worker
```

If the local npm cache is healthy, a plain `npm install --prefix integrations/square-catalog-worker` also works.

The Jekyll site still uses the Ruby toolchain described in `AGENTS.md`. On the machine used for this implementation, local `bundle exec jekyll build` is blocked by Ruby `2.6.10`; GitHub Pages itself is still the production build target.

## Deploy the Worker

1. Authenticate Wrangler if needed:

```bash
npx wrangler login
```

2. Set the Square token secret:

```bash
npx wrangler secret put SQUARE_ACCESS_TOKEN \
  --config integrations/square-catalog-worker/wrangler.toml
```

3. Confirm the non-secret Cloudflare account ID, Square location ID, and shipping fee before deploy. Keep these deploy-time values in `wrangler.toml` or the Cloudflare dashboard, but never store the access token in the repo. If the shipping fee changes, update the customer-facing disclosure in `_includes/square-catalog.html` in the same change.

4. Deploy:

```bash
npx wrangler deploy --config integrations/square-catalog-worker/wrangler.toml
```

5. Copy the deployed worker base URL and set `_config.yml`:

```yml
square_catalog_api_base: "https://<your-worker>.workers.dev"
```

6. Commit and push the repo so the site points at the deployed worker URL.

## Validate After Deploy

### Worker API

Catalog:

```bash
curl -H 'Origin: https://hermeticus.org' \
  'https://<your-worker>.workers.dev/catalog'
```

Expected result:

- HTTP `200`
- JSON array
- only short keys: `i`, `v`, `n`, `p`, `d`, `c`, `m`, `q`
- `d` contains Square `description_html` when available, otherwise Square
  plaintext description data

Checkout:

```bash
curl -X POST 'https://<your-worker>.workers.dev/checkout' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://hermeticus.org' \
  --data '{"items":[{"v":"<variation-id>","q":1}]}'
```

Expected result:

- HTTP `200`
- JSON containing `u`
- the `u` value opens a Square-hosted checkout page
- the checkout page adds a $5.00 "Flat-rate shipping" charge
- the checkout page requires the buyer's name, phone number, and shipping address, creating a `SHIPMENT` fulfillment
- the checkout page requires the buyer to type `YES` in a "US shipping only" confirmation field

Shipping collection is driven entirely by the `CreatePaymentLink` request (`checkout_options.ask_for_shipping_address`), not by Square dashboard settings. After the buyer pays, the address is stored on the order in `fulfillments[].shipment_details`. The website and Worker do not store customer addresses.

### Fulfill a Paid Order

Square Orders Manager is the source of truth for fulfillment:

1. Open the paid order in Square Orders Manager. Do not ship from a website return message alone.
2. Confirm the payment is completed and review the books, US-shipping confirmation, recipient, phone number, and shipping address. If the address is outside the United States, contact the buyer and refund the order instead of shipping it at the domestic flat rate.
3. Pack and send the books using the shop's normal mailing method.
4. Record tracking information when available and complete the fulfillment manually in Square Orders Manager. Payment-link orders with fulfillments remain open until this step.

Square Checkout API links are single-use and are created separately for each cart. The links themselves are not managed like reusable Dashboard payment links.

Square's hosted Checkout API does not provide a country allowlist. The cart discloses the US-only policy, Square requires the buyer to confirm it, and the shop verifies the country before fulfillment.

### Public Site

After the repo is pushed:

- `/books/` shows live books from Square
- a buyer can add multiple distinct books to the cart
- clicking checkout redirects to Square
- the cart discloses US-only, $5 flat-rate shipping before checkout
- reducing stock to zero or archiving a book removes it after cache refresh

## Operational Notes

- `GET /catalog` is edge-cached to reduce load on Square.
- `POST /checkout` always validates against live Square data instead of using the cached public payload.
- `POST /checkout` fails before contacting Square if the configured shipping fee is unsafe.
- The worker fails closed. If validation or Square access fails during checkout creation, no payment link is created.

## Rollback

### Worker rollback

- Redeploy the previous known-good worker version from the last good commit.

### Site rollback

- Set `_config.yml` `square_catalog_api_base` back to an empty string and push.
- The `/books/` page will stop trying to load the worker and will show the configuration message instead of broken checkout UI.

### Secret rotation

If the Square token is rotated or revoked:

```bash
npx wrangler secret put SQUARE_ACCESS_TOKEN \
  --config integrations/square-catalog-worker/wrangler.toml
```

No code change is required.
