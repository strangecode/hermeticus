# Architecture

Purpose: describe the current stable technical map of the system.

Instructions:
- Document the system as it currently exists in stable form.
- Focus on major components, boundaries, interfaces, data flow, storage, external dependencies, and invariants.
- Update this file when implemented changes alter the stable technical shape of the system.
- Keep this file descriptive of current reality, not speculative.
- Do not use this file as a task log, scratchpad, or decision diary.
- Additional documents may be created when describing the details of major components. For example, the documentation for an API may be linked to an OpenAPI specification at `docs/api.yaml`.

## System Overview

Hermeticus is a static Jekyll site deployed on GitHub Pages at `https://hermeticus.org`. Most pages are fully static, but the `/books/` page now depends on a separate Cloudflare Worker to read live book data from Square and create hosted checkout sessions. The site itself never stores Square secrets and never handles payment card entry.

## Major Components and Boundaries

- **GitHub Pages Jekyll site**
  Stores page content, layouts, styles, and browser-side catalog code. It renders the page shell for `/books/`, loads `assets/js/main.js`, and points that code at the deployed worker URL through `_config.yml`.
- **Cloudflare Worker**
  Lives in `integrations/square-catalog-worker/`. It exposes:
  - `GET /catalog` for public catalog reads
  - `POST /checkout` for server-validated cart checkout creation
  The worker is the only component that talks to Square APIs.
- **Square Catalog API**
  Source of item, category, image, and variation data.
- **Square Inventory API**
  Source of the current stock count for each published book at one configured Square location.
- **Square Checkout API**
  Creates Square-hosted payment links for validated multi-item carts.

## Interfaces and Data Flow

1. A visitor opens `/books/` on `hermeticus.org`.
2. The static page shell from `pages/books.md` and `_includes/square-catalog.html` loads.
3. `assets/js/main.js` reads `square_catalog_api_base` from `_config.yml` and requests `GET <worker>/catalog`.
4. The worker checks Cloudflare edge cache.
5. On a cache miss, the worker:
   - paginates through Square `ListCatalog` for `ITEM`, `CATEGORY`, and `IMAGE`
   - extracts items that are publishable for v1
   - retrieves inventory counts for candidate variation IDs at `SQUARE_LOCATION_ID`
   - returns a compact JSON array with short keys
   - caches that response at Cloudflare
6. The browser renders cards with category, gallery images, description, price, stock count, and add-to-cart controls.
7. When the buyer checks out, `assets/js/main.js` sends `POST <worker>/checkout` with variation IDs and requested quantities.
8. The worker bypasses the cached public payload, rebuilds current live availability from Square, validates the cart, and creates a Square-hosted payment link.
9. The browser redirects the buyer to Square’s checkout page.

The public catalog payload uses these keys:

- `i` item ID
- `v` variation ID
- `n` name
- `p` price in minor units
- `d` description
- `c` category name
- `m` image URL list
- `q` quantity available

The checkout payload returns `{ "u": "<square-checkout-url>" }` on success.

## Storage and External Dependencies

- No database is used by the site or worker.
- Catalog browse results are cached at Cloudflare edge with a short TTL.
- Secrets are stored only in Cloudflare Worker secrets:
  - `SQUARE_ACCESS_TOKEN`
- Non-secret worker configuration currently includes:
  - `ALLOWED_ORIGINS`
  - `SQUARE_ENV`
  - `SQUARE_LOCATION_ID`
  - `CATALOG_TTL_SECONDS`
  - `SQUARE_VERSION`
- Site-side worker location is configured in `_config.yml` through `square_catalog_api_base`.
- External runtime dependencies:
  - GitHub Pages / Jekyll
  - Cloudflare Workers
  - Square Catalog, Inventory, and Checkout APIs

## Invariants

- The public Git repository contains no Square or Cloudflare secrets.
- Payment card entry never happens on `hermeticus.org`; buyers complete payment on Square-hosted checkout.
- Only items with exactly one sellable variation and positive tracked inventory at the configured Square location are published on `/books/`.
- Items with zero inventory or archived state disappear from the public catalog after cache refresh.
- `GET /catalog` is cacheable; `POST /checkout` must validate against fresh Square data before creating a checkout link.
- Browser code must construct DOM nodes from API data and must not inject catalog text with `innerHTML`.
