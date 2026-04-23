# P-001 – Dynamic Square catalog and hosted checkout

## Purpose / Big Picture

Hermeticus needs the placeholder `/books/` page replaced with a real, buyer-facing catalog that pulls live inventory from Square and lets visitors buy one or more books through Square-hosted checkout. The website remains a static Jekyll site on GitHub Pages. A repo-owned Cloudflare Worker provides the dynamic layer: it reads Square catalog and inventory data, caches the public catalog response at Cloudflare, validates cart requests server-side, and creates Square payment links so card data never touches this repository or the browser code.

V1 is intentionally narrow:

- show live books from Square on `pages/books.md`
- include name, price, customer-facing description, category, stock-aware purchase controls, and multiple images
- support a simple multi-item cart
- send buyers to a Square-hosted checkout page
- keep all secrets out of git and out of the browser

## Context and Orientation

Repository facts as of 2026-04-22:

- The public site origin is `https://hermeticus.org`, from `CNAME`.
- The current catalog page is a placeholder at `pages/books.md`.
- Jekyll serves `assets/js/main.js` on every page from `_layouts/default.html`.
- Sass entrypoint is `assets/css/main.scss`, which currently imports `_sass/_tokens.scss`, `_sass/_base.scss`, `_sass/_layout.scss`, and `_sass/_components.scss`.

External system facts used by this plan:

- Square Catalog items always contain at least one variation. V1 treats a book as publishable only when it has exactly one sellable variation. Multiple variations are out of scope for now and will be skipped.
- Square `ListCatalog` returns up to 100 objects per page and uses cursors. The worker must paginate.
- Square exposes category names on `CATEGORY` objects and item image URLs on `IMAGE` objects.
- Square Checkout `CreatePaymentLink` can create a Square-hosted checkout page for an order containing multiple line items.
- Square Payment Links currently advertise no monthly fee on Square’s public pricing page; transaction fees still apply.
- Cloudflare Workers support secrets and cacheable responses at the edge.

V1 publishing rule:

- A book appears on the website only if it is active in Square, has exactly one variation, has a non-zero price, and has tracked inventory above zero at the configured Square location.
- Archiving the item or reducing inventory to zero removes it from the website after cache expiry or refresh.

## Scope

- Add a repo-owned Cloudflare Worker project at `integrations/square-catalog-worker/`.
- Implement `GET /catalog` on the worker to return a minimal JSON array of public book data.
- Cache the `GET /catalog` response at Cloudflare so the Square APIs are not called on every page view.
- Implement `POST /checkout` on the worker to validate a submitted cart against fresh Square data and create a Square-hosted payment link for one-or-more books.
- Replace the placeholder content in `pages/books.md` with a catalog mount point, explanatory copy, and no-JavaScript fallback text.
- Extend `assets/js/main.js` to render the catalog, manage a lightweight cart, and redirect buyers to Square checkout.
- Add catalog and cart styling in the existing Sass structure.
- Add operator documentation for configuration, deployment, and rollback.
- Add a Docker-based local preview workflow so the site can be served without relying on host Ruby setup.
- Update durable docs for the new architecture and decisions.

## Non-goals

- No custom backend other than the Cloudflare Worker.
- No card-entry UI on `hermeticus.org`.
- No user accounts, saved carts, wishlists, search indexing, or faceted filtering.
- No support for Square items with multiple sellable variations.
- No modifiers, subscriptions, shipping calculation, tax customization, discount codes, or custom attributes.
- No attempt to make the static site work as a storefront without JavaScript. With JavaScript disabled, the books page remains informational and directs users to contact the shop.

## Interfaces and Dependencies

- `integrations/square-catalog-worker/src/index.js`
  Public worker entrypoint with two routes:
  - `GET /catalog`
  - `POST /checkout`
- `integrations/square-catalog-worker/wrangler.toml`
  Worker config with no secrets committed.
- `integrations/square-catalog-worker/package.json`
  Local tooling for tests and deploy commands.
- `integrations/square-catalog-worker/test/*.test.js`
  Worker-focused tests for filtering, serialization, CORS, and checkout validation.
- `_includes/square-catalog.html`
  HTML shell for the catalog UI.
- `assets/js/main.js`
  Client-side rendering and cart logic.
- `assets/css/main.scss`
  Sass entrypoint that must import any new partial used for catalog styles.
- `_sass/_components.scss`
  Existing component layer; preferred place for catalog and cart styles unless the code becomes too large.
- `pages/books.md`
  Public catalog page.
- `docs/architecture.md`
  Stable description of the Jekyll-to-Worker-to-Square flow.
- `docs/decisions.md`
  Durable rationale for hosted checkout, inventory-gated publishing, and cached public JSON.
- `docs/square-catalog.md`
  Runbook for deployment, secrets, and recovery.

Worker configuration, all repo-visible and non-secret unless marked secret:

- `ALLOWED_ORIGINS`
  Comma-separated list. V1 must include `https://hermeticus.org`. Local preview origin `http://127.0.0.1:4000` may be added for development.
- `SQUARE_ENV`
  `production` or `sandbox`.
- `SQUARE_LOCATION_ID`
  Square location to use for inventory checks and checkout creation.
- `CATALOG_TTL_SECONDS`
  Edge cache TTL for `GET /catalog`. V1 target: `300`.
- `SQUARE_ACCESS_TOKEN`
  Secret. Never committed.
- `SQUARE_VERSION`
  Pinned API version string used in outbound Square requests.

Public catalog JSON shape from `GET /catalog`:

- Top-level value: array
- Item keys:
  - `i` – Square item ID
  - `v` – Square variation ID
  - `n` – item name
  - `p` – price in minor units
  - `d` – customer-facing description or empty string
  - `c` – category name or empty string
  - `m` – array of image URLs
  - `q` – integer quantity available at `SQUARE_LOCATION_ID`

Checkout request and response shape:

- `POST /checkout`
  Request body: `{ "items": [{ "v": "<variation-id>", "q": <integer> }, ...] }`
- Response body on success: `{ "u": "<square-checkout-url>" }`

## Plan of Work

1. Rewrite the plan into a concrete v1 architecture and move it to `plans/active/`.
2. Scaffold the worker in `integrations/square-catalog-worker/` with repo-owned config and tests.
3. Implement Square client code for:
   - paginated catalog fetch of `ITEM,CATEGORY,IMAGE`
   - inventory count retrieval for publishable variation IDs
   - creation of a hosted payment link for a validated cart
4. Implement edge caching for the public catalog response with a short TTL and explicit cache headers.
5. Replace the `/books/` placeholder page with a real catalog shell and cart UI.
6. Validate the full flow locally and through worker tests. Deploy the worker, then point the site at the deployed worker URL.
7. Update progress and durable docs as concrete outcomes land.

## Concrete Steps

All repo commands run from `/Users/q/src/hermeticus` unless noted.

1. Create the worker project:

```bash
mkdir -p integrations/square-catalog-worker/src integrations/square-catalog-worker/test
```

2. Add worker files:

- `integrations/square-catalog-worker/package.json`
- `integrations/square-catalog-worker/wrangler.toml`
- `integrations/square-catalog-worker/src/index.js`
- `integrations/square-catalog-worker/test/catalog-worker.test.js`

3. Install worker dependencies:

```bash
npm install --prefix integrations/square-catalog-worker
```

4. Run worker tests:

```bash
npm test --prefix integrations/square-catalog-worker
```

5. Update site files:

- create `_includes/square-catalog.html`
- replace `pages/books.md`
- update `assets/js/main.js`
- update `assets/css/main.scss` if a new Sass partial is added
- update `_sass/_components.scss` or add `_sass/_catalog.scss`

6. Build Jekyll:

```bash
bundle exec jekyll build
```

7. Configure Cloudflare secrets and vars before deploy:

```bash
npx wrangler secret put SQUARE_ACCESS_TOKEN --config integrations/square-catalog-worker/wrangler.toml
npx wrangler deploy --config integrations/square-catalog-worker/wrangler.toml
```

8. Validate the deployed worker:

```bash
curl -H 'Origin: https://hermeticus.org' '<worker-url>/catalog'
curl -X POST '<worker-url>/checkout' \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://hermeticus.org' \
  --data '{"items":[{"v":"<variation-id>","q":1}]}'
```

9. Set the site-side worker URL in the page or include configuration and push the Jekyll changes to `main`.
10. Add `Dockerfile` and `docker-compose.yml` for local Jekyll preview with the project mounted into the container and host-accessible ports.

## Validation and Acceptance

Acceptance is met only when all of the following are true:

- `npm test --prefix integrations/square-catalog-worker` passes.
- `bundle exec jekyll build` succeeds with no warnings introduced by this work.
- `GET /catalog` responds `200` to `Origin: https://hermeticus.org` and returns a JSON array using only the documented short keys.
- `GET /catalog` omits items that are archived, zero-priced, have zero inventory, or have more than one variation.
- `GET /catalog` includes category names and all associated item image URLs for publishable items.
- Repeated `GET /catalog` requests hit Cloudflare cache according to headers and do not call Square on every request.
- `POST /checkout` rejects malformed carts, empty carts, duplicate variation IDs, quantities below 1, and quantities above current stock.
- `POST /checkout` creates a Square-hosted checkout URL for a valid multi-item cart.
- The `/books/` page loads the catalog, renders image galleries, price, description, category, and stock-aware purchase controls.
- A buyer can add more than one distinct book to the cart and reach a Square-hosted checkout page.
- With JavaScript disabled, `/books/` still presents meaningful explanatory content and contact information instead of broken UI.
- Reducing a listed item’s inventory to zero or archiving it in Square removes it from the public page after cache expiry or refresh.

## Idempotence and Recovery

- Re-running `npx wrangler deploy --config integrations/square-catalog-worker/wrangler.toml` updates the worker in place without exposing secrets.
- Rotating the Square token requires only re-running `wrangler secret put`; no code changes are needed.
- If the deployed worker breaks the site:
  - set the books page back to static explanatory content and push, or
  - redeploy the previous known-good worker version from the last good commit
- If the worker cannot reach Square, `GET /catalog` should fail closed with a clear error response and the browser should render a friendly unavailable state.
- If `POST /checkout` cannot validate live inventory, it must return an error and avoid creating a stale payment link.
- If local preview needs worker access, add `http://127.0.0.1:4000` to `ALLOWED_ORIGINS` for development only.

## Progress

- [x] Moved `P-001` from `plans/queue/` to `plans/active/`.
- [x] Reviewed the original plan against repo state and current external docs.
- [x] Chose the v1 architecture: cached public catalog endpoint plus server-validated multi-item hosted checkout.
- [x] Scaffold `integrations/square-catalog-worker/`.
- [x] Implement worker routes, filtering, caching, and checkout creation.
- [x] Replace the `/books/` placeholder with the dynamic catalog UI.
- [x] Run worker tests and `bundle exec jekyll build`.
- [ ] Deploy the worker and wire the final worker URL into the site.
- [x] Update `plans/progress.md`, `docs/architecture.md`, `docs/decisions.md`, and `docs/square-catalog.md`.
- [x] Add Docker-based local preview files and usage notes.
- [x] Commit and push to `main`.

## Surprises & Discoveries

- 2026-04-22: The placeholder catalog page already exists at `pages/books.md`, so v1 should replace that page directly instead of introducing a second product page.
- 2026-04-22: The shared `page` layout wraps content in `.prose`, which caps the catalog UI at `40rem`; the books page needs a full-width body while keeping its intro copy readable.
- 2026-04-22: `CNAME` already fixes the production origin as `https://hermeticus.org`, so the production CORS allowlist value is known and should not remain an open question.
- 2026-04-22: Square `ListCatalog` paginates at 100 objects per page, so the worker must iterate cursors even though current catalog size will likely be much smaller.
- 2026-04-22: Square Checkout supports hosted checkout for an order with multiple line items, which makes a lightweight cart feasible without exposing payment credentials in the browser.
- 2026-04-22: `npm install` initially failed because the default npm cache contains root-owned files on this machine. Using a temp cache directory worked without changing global state.
- 2026-04-22: `bundle exec jekyll build` is currently blocked in this environment because the installed Ruby is `2.6.10`, while the current `github-pages` dependency set now resolves gems that require Ruby `>= 3.0`.
- 2026-04-22: Running the GitHub Pages Jekyll stack directly on a modern host Ruby surfaced several compatibility issues, so a containerized local preview flow is useful even after the site itself works in production.
- 2026-04-22: The repo already had `.bundle/config` pointing at `vendor/bundle`, so the Docker setup needs its own `BUNDLE_APP_CONFIG` and bundle volume to avoid rewriting repo-local Bundler settings.
- 2026-04-22: For this repo’s local preview workflow, it is better to bake gems into the Docker image and rebuild on `Gemfile` or `Gemfile.lock` changes than to run `bundle install` on every container start.
- 2026-04-22: After updating to the current GitHub Pages gemset, `jekyll serve --livereload` in Docker still crashes in Jekyll’s LiveReload WebSocket layer with `HTTP::Parser::Error`, even though the site build succeeds.

## Decision Log

- 2026-04-22: V1 uses Square-hosted checkout created by the worker instead of embedding payment fields on the website.
  Reason: This is the simplest secure path, keeps card handling off the site, and supports multi-item orders.
- 2026-04-22: V1 requires exactly one sellable variation per published book and skips items with multiple variations.
  Reason: The project explicitly does not want user-facing variations yet, and filtering them out avoids ambiguous pricing and inventory rules.
- 2026-04-22: V1 publishes only items with tracked inventory above zero at one configured Square location.
  Reason: Inventory-gated publishing is the simplest reliable way to avoid advertising sold items.
- 2026-04-22: The worker returns a compressed public schema with short keys.
  Reason: The catalog is read often and changes infrequently; compact responses reduce bandwidth without hiding meaning in the codebase.
- 2026-04-22: `GET /catalog` is cached, but `POST /checkout` validates against fresh Square data.
  Reason: Browsing should be cheap and fast, while checkout should prioritize correctness over cache hits.
- 2026-04-22: Local preview should run in Docker with the repo bind-mounted into the container.
  Reason: That keeps Ruby and gem churn off the host machine while still giving a reproducible preview environment for Jekyll work.
- 2026-04-22: The Docker image should contain Ruby gems, while the bind mount should contain only source files from the host repo.
  Reason: This matches the intended workflow better, avoids repeated startup installs, and keeps dependency ownership inside the container boundary.
- 2026-04-22: The Docker preview should prefer a stable `jekyll serve` process over built-in LiveReload.
  Reason: A working local server is more important than automatic refresh, and the current LiveReload path is crashing after the site has already built successfully.

## Outcomes & Retrospective

- In progress. Worker tests pass, `bundle exec jekyll build` succeeds inside the Dockerized Ruby environment, the deployed catalog works on the live site, the repo now has a stable Docker-based local preview path, and the home/about content reflects the shop visitors actually describe. Final plan closure still depends on user review and explicit confirmation.

## Change Log

- 2026-04-22: Activated the plan, removed contradictions, chose the v1 architecture, and rewrote the plan as an execution-ready document.
- 2026-04-22: Updated the books page and catalog UI follow-up scope to remove the stale loading banner, break the catalog out of the prose column, and restyle the cart as a distinct sidebar.
- 2026-04-22: Reverted the empty-cart hiding and mobile cart reordering follow-up after it behaved incorrectly in the live layout.
- 2026-04-22: Replaced placeholder home-page and about-page copy with review-based content, and tightened the home hero copy to better match the shop.
