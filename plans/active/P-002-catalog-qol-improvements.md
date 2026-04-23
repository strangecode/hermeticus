# P-002 – Catalog QoL Improvements

## Purpose / Big Picture

Hermeticus already has a working live catalog and cart on `/books/`, but the current experience still feels closer to a technical proof of concept than a comfortable shopping page. After this plan is implemented, visitors should be able to find relevant books faster, keep their cart intact if they reload the page, recover more gracefully from stock or checkout errors, and scan the catalog with less visual fatigue. The result should be a higher-quality buying flow without changing the site’s architecture or adding a new backend.

The clearest before-and-after proof is a manual pass through `/books/`: a user can search and narrow the catalog, sort results, add books with less friction, refresh the page without losing their cart, understand what changed when stock conflicts happen, and continue browsing after a successful return from Square checkout.

## Context and Orientation

Repository facts as of 2026-04-23:

- The catalog page lives at `pages/books.md` and mounts the interactive UI through `_includes/square-catalog.html`.
- Browser behavior lives in `assets/js/main.js`. That file currently:
  - fetches `GET /catalog` from the worker URL configured in `_config.yml`
  - renders book cards into `[data-catalog-grid]`
  - manages an in-memory cart only
  - sends `POST /checkout` to the worker and redirects to the returned Square-hosted URL
- Catalog styling lives in `_sass/_catalog.scss`, imported by `assets/css/main.scss`.
- The current worker lives in `integrations/square-catalog-worker/` and returns a compact catalog schema:
  - `i` item ID
  - `v` variation ID
  - `n` book title
  - `p` price in minor currency units
  - `d` description
  - `c` category name
  - `m` image URL array
  - `q` available quantity
- The site must remain usable with JavaScript disabled. For the books page, this currently means explanatory copy plus fallback "contact us" guidance rather than a fully functional storefront.
- The repo’s design rules still apply: no framework, no new runtime, no speculative backend features, no hard-coded visual values outside the token system, and no abandonment of the static Jekyll plus worker architecture established in `P-001`.

Important current shortcomings this plan addresses:

- Browsing is linear only. There is no search, category filter, or sort control.
- The cart disappears on reload because it lives only in memory.
- Error and success messaging is functional but shallow. It does not clearly guide recovery when stock changes or checkout fails.
- The quantity control on each card is a raw number input, which adds friction for the common case of buying one copy.
- The catalog grid is usable, but it becomes tiring to scan as the number of books grows.
- The dynamic announcements are not yet tuned for the most accessible experience when the cart or result set changes.

## Scope

This plan includes the next round of quality-of-life improvements for the existing catalog page:

- add client-side search across book title, category, and description
- add category filtering derived from the live catalog payload
- add basic sorting for relevance to browsing: category, title, and price
- persist the cart in browser storage and restore it on page load
- improve add-to-cart and checkout feedback, including simple stock-conflict recovery
- replace the raw card-side quantity workflow with lower-friction purchase controls (99% of products will be one-of-a-kind quantity=1 items, but there should be a way to set a quantity higher than 1 without cluttering the UI)
- improve catalog card display and empty-result states so the page is easier to scan (mobile-first responsive design)
- strengthen accessibility for dynamic updates, controls, and result changes
- clicking the product image should open it full-size in a minimal lightbox-style UI that prefers native browser APIs (`<dialog>` if available), dismisses via click and `Escape`, and falls back to opening the raw image URL in the browser when the lightbox cannot run

## Non-goals

- No new backend routes or schema changes unless implementation reveals a strict need that cannot be handled client-side.
- No user accounts, wishlists, saved browsing history, recommendations, or analytics.
- No faceted search beyond category filtering and simple sorting.
- No search service, indexer, or server-side query API.
- No support for advanced product metadata not already present in the worker payload. In particular, this plan does not assume reliable author, publisher, edition, or format fields exist in Square.
- No migration away from Square-hosted checkout.
- No JavaScript-dependent critical path for non-catalog pages.

## Interfaces and Dependencies

- `pages/books.md`
  Keeps the page-level intro copy. May need a short explanatory sentence if new controls change how users browse the page.
- `_includes/square-catalog.html`
  Needs the structural shell for search, filter, sort, results summary, and any additional live-region or empty-state containers.
- `assets/js/main.js`
  Primary implementation surface for:
  - catalog indexing for search/filter/sort
  - cart persistence via `localStorage`
  - post-checkout URL cleanup for `?checkout=success`
  - improved announcements, error handling, and success handling
  - new add-to-cart controls
  - image lightbox behavior with a raw-image fallback
- `_sass/_catalog.scss`
  Primary styling surface for catalog controls, result summaries, empty states, refined card layout, and persisted-cart affordances.
- `_sass/_components.scss`
  May be touched only if a control style clearly belongs in the shared component layer rather than catalog-specific styles.
- `integrations/square-catalog-worker/src/index.js`
  Read-only dependency unless implementation proves a missing field or contract change is necessary. The plan assumes current catalog fields are sufficient.
- `integrations/square-catalog-worker/test/catalog-worker.test.js`
  Likely unchanged unless the worker contract changes.
- `_config.yml`
  Read-only dependency for `square_catalog_api_base`.
- `docs/architecture.md`
  Update only if implementation changes the stable technical map, such as introducing durable client-side cart persistence as a site invariant.
- `docs/decisions.md`
  Update only if implementation introduces a reusable durable decision, such as a canonical rule for client-side state persistence.

Browser and platform dependencies:

- Native browser APIs only: `fetch`, `URLSearchParams`, `Intl.NumberFormat`, `localStorage`, `history.replaceState`, and `<dialog>` when supported.
- No new package dependency should be added for search, state management, or UI controls.

## Plan of Work

This work should stay inside the existing books-page shell, not spread into a new subsystem.

First, reshape `_includes/square-catalog.html` so the page has explicit areas for browsing controls, result status, and improved cart messaging. The HTML should remain meaningful before JavaScript enhancement and should provide clear hooks for script and styles. A small control bar above the grid is sufficient; there is no need for a new panel or a mobile-only navigation pattern.

Next, refactor `assets/js/main.js` around a clearer client-side state model. The current single-pass rendering works for the existing grid and cart, but search, filtering, sorting, and cart persistence need explicit derived state. The implementation should separate:

- raw catalog data from the worker
- current browse controls
- derived visible results
- cart state
- transient status and message state

That state should still live in one file unless the file becomes unreasonably hard to follow. The goal is clarity, not abstraction for its own sake.

Cart persistence should use `localStorage` with a repo-owned key name scoped to the catalog page. The restored cart must be validated against the freshly loaded live catalog before being rendered. Invalid or out-of-stock entries should be discarded with a user-visible message rather than silently retained.

Search, filter, and sort should run entirely in the browser against the loaded catalog array. The control set should be intentionally small:

- a text search input
- a category select populated from catalog data
- a sort select with category, title ascending, price low-to-high, and price high-to-low
- a reset action when any browse control is active

The UI should clearly communicate the current result count and when zero books match the current controls.

The purchase workflow should be simplified around the fact that most book purchases are one copy. Prefer a one-click default add action from the card, with quantity adjustment handled in the cart stepper controls. If a card-side quantity input remains, it should be justified by actual usability after review; the default plan is to remove it.

Checkout feedback should become more specific. Examples:

- when checkout fails because availability changed
- when the user returns from Square with `?checkout=success`
- when a search or filter reduces the list to zero items

Cart restore should stay simple. On load, the browser may silently discard stored items that no longer exist or no longer have stock. This shop has a small catalog and low order volume, so correctness and maintainability matter more than rare edge-case messaging.

The image interaction should stay minimal. Use a native `<dialog>` as the first choice for the lightbox. Clicking the enlarged image backdrop or pressing `Escape` should dismiss it. If `<dialog>` is unavailable or the chosen image cannot be opened in that UI, the image button should open the raw large image URL in the browser instead of leaving the control inert.

Finally, refine `_sass/_catalog.scss` so the catalog controls, result summaries, cards, and cart read as one coherent browsing interface. This should improve readability and hierarchy, not chase a redesign.

## Concrete Steps

All commands run from `/Users/q/src/hermeticus` unless noted otherwise.

1. Review the queued plan against current repo state before implementation starts:

```bash
sed -n '1,320p' plans/active/P-002-catalog-qol-improvements.md
sed -n '1,260p' _includes/square-catalog.html
sed -n '1,360p' assets/js/main.js
sed -n '1,260p' _sass/_catalog.scss
```

2. Update the catalog shell and page content:

- edit `_includes/square-catalog.html`
- edit `pages/books.md` if the intro copy or fallback guidance needs to mention the new controls

3. Implement the client-side behavior in `assets/js/main.js`:

- add browse controls state
- derive filtered and sorted results
- persist and restore cart state
- validate restored cart entries against live stock
- improve dynamic announcements and error handling
- simplify add-to-cart controls
- add the image lightbox with a raw-image fallback

4. Update styles in `_sass/_catalog.scss` and only touch `_sass/_components.scss` if a shared primitive is clearly warranted.

5. Run targeted validation:

```bash
npm test --prefix integrations/square-catalog-worker
```

Expected result: existing worker tests still pass. If the worker contract remains unchanged, no new worker tests should be necessary.

6. Run the Jekyll build in Docker, which is the intended local path in this repo:

```bash
docker compose up --build
```

Expected result: the site serves locally at `http://127.0.0.1:4000/` and the books page renders with the new controls and behaviors.

7. Manually verify `/books/` in the browser:

- search for a known word from a title or description
- filter by category
- change sorting
- add at least two books
- reload the page and confirm the cart persists
- remove one item and confirm state updates
- simulate an empty-result state with an unlikely search term
- open a product image, dismiss it with click, reopen it, and dismiss it with `Escape`
- test keyboard-only navigation through the controls and cart

8. If implementation changes stable architecture or durable decisions, update:

- `docs/architecture.md`
- `docs/decisions.md`
- `plans/progress.md`

9. Commit and push directly to `main` only after the browsing and checkout flow is stable and validated.

## Validation and Acceptance

Acceptance is met only when all of the following are true:

- The books page includes visible browse controls for search, category filtering, and sorting.
- Search matches text from `n`, `c`, and `d` fields without requiring a network round-trip.
- Category filter options are derived from the live catalog payload rather than hard-coded.
- Sorting changes only the presentation order of the currently matched result set and includes category, title, and price options.
- The page displays a clear result-count summary and a clear empty-results state with a reset path.
- Adding a book from the grid defaults to one copy with minimal friction.
- Quantity can still be increased or decreased from the cart without breaking stock validation.
- Reloading the page restores cart contents from browser storage when those items still exist and still have stock.
- Restored cart items that are no longer valid are removed safely, even if that happens silently.
- Checkout errors leave the cart intact and give a specific, actionable message when possible.
- Returning from Square checkout shows a clearer success state and does not leave the page in an ambiguous state.
- Clicking a product image opens a minimal enlarged-image view when supported, and the same control falls back to the raw image URL when that view cannot be used.
- The enlarged-image view dismisses via backdrop click and `Escape`.
- The page remains usable with JavaScript disabled: explanatory copy remains visible and the noscript fallback still directs the visitor to contact the shop.
- Keyboard-only navigation can reach search, filter, sort, add-to-cart, cart controls, and checkout in a sensible order.
- Screen-reader-relevant updates use appropriate live announcements for catalog load, cart changes, and empty-result or error states.
- `npm test --prefix integrations/square-catalog-worker` passes.
- The Docker-based local site preview starts and the `/books/` page renders without layout breakage at desktop and mobile widths.

## Idempotence and Recovery

- Re-running the JavaScript and Sass edits is safe as long as the plan remains in `plans/active/` and the acceptance criteria remain current.
- If cart persistence behaves incorrectly, disable only the persistence layer and keep the improved browse controls. Do not block the entire QoL release on `localStorage`.
- If search and filtering work but sorting introduces confusion, ship search and category filtering first and defer sort in a recorded plan update rather than leaving a half-working control in the UI.
- If a restored cart cannot be reconciled safely with live stock, clear only the invalid lines. Do not clear the entire cart unless the stored data is malformed.
- If new styles degrade the mobile layout, revert only the layout changes in `_sass/_catalog.scss` and keep behavior improvements that remain stable.
- If the dialog-based lightbox misbehaves in a browser, fall back to opening the raw image URL and keep the catalog browsing flow intact.
- If any change requires a worker contract update after implementation begins, stop and revise this plan before continuing. Do not silently widen scope into a backend change.

## Milestones

### Milestone 1 – Browsing Controls

Goal: users can narrow and reorder the catalog without extra network requests.

Result:

- search, category filter, and sorting controls exist
- visible results update immediately
- a clear result summary and empty state exist

Proof:

- manual verification on `/books/`
- keyboard navigation through the controls works

### Milestone 2 – Cart Resilience

Goal: the cart behaves like shopping progress rather than temporary page state.

Result:

- cart persists across reloads
- restored data is validated against live catalog stock
- invalid restored lines are handled gracefully

Proof:

- add books, reload, and verify cart restoration
- verify invalid stored state is removed with explanation

### Milestone 3 – Feedback and Polish

Goal: the page explains what is happening at each step and is easier to scan.

Result:

- clearer success and error messaging
- lower-friction add flow
- better card hierarchy
- stronger live announcements and empty states

Proof:

- manual pass through add, remove, checkout failure handling, and post-checkout return

## Pre-execution User Q&A

No blocking questions are required to start implementation. The plan assumes:

- search runs over title, category, and description only
- sorting options are limited to title and price
- the worker payload remains unchanged unless implementation proves otherwise

If the user later wants a different priority order, or extra metadata, record that change in this section and update the plan before execution.

## Progress

- [x] Create execution-ready plan.
- [x] Reviewed the plan against the current repo state immediately before implementation.
- [x] Confirmed the plan is already active and revised it to match approved scope.
- [x] Implemented browse controls and empty-state handling in `_includes/square-catalog.html`, `assets/js/main.js`, and `_sass/_catalog.scss`.
- [x] Implemented cart persistence and validation on restore in `assets/js/main.js` using `localStorage` with silent removal of invalid lines.
- [x] Implemented lower-friction add-to-cart, clearer result and cart messaging, and native-dialog image lightbox behavior with anchor fallback.
- [x] Ran worker tests, `node --check assets/js/main.js`, `git diff --check`, and Docker-based local validation at `http://127.0.0.1:4000/books/`.
- [x] Updated durable docs in `docs/architecture.md` and `docs/decisions.md` for client-side cart persistence.
- [ ] Committed and pushed the completed work to `main`.

## Surprises & Discoveries

- 2026-04-23: `plans/queue/P-002-catalog-qol-improvements.md` already existed as a generic template stub, so the right move was to replace it in place rather than allocate a new plan ID.
- 2026-04-23: The current worker payload already contains enough fields for search, category filtering, sorting by price/title, so this QoL pass should remain client-side unless implementation uncovers a real data gap.
- 2026-04-23: Using image anchors as the clickable affordance gives the required raw-image fallback for free when `<dialog>` is unavailable or `showModal()` fails, which is simpler than building a separate fallback path in script.
- 2026-04-23: The worker payload shape should be normalized once on load before rendering so optional strings and image arrays cannot break the client UI when a Square record is sparse.
- 2026-04-23: Catalog-specific `display` rules overrode the native `hidden` attribute on the empty state and reset button. Adding `.catalog-app [hidden] { display: none !important; }` restored the intended behavior without restructuring the markup.
- 2026-04-23: Post-release review found three small client regressions: restored carts kept the placeholder empty-cart message, the cart total block needed stronger separation from line items, and result-count copy should stay in the “showing all” form when only sort order changes.
- 2026-04-23: Clearing the restored-cart placeholder should not depend on exact text matching because the seeded HTML message includes surrounding whitespace from markup formatting. Blank the cart message whenever a populated cart renders and let action-specific calls restore messages afterward.
- 2026-04-23: A later review found that the empty-result state duplicated itself by announcing “No books match…” both in the lightweight result line and again in the callout. When the empty callout is visible, the compact result line should be blank.
- 2026-04-23: A deploy review found that changed CSS could stay cached across a normal reload on GitHub Pages. The native repo-friendly fix is to append a GitHub Pages build-specific query string from `site.github.build_revision` to asset URLs in the shared layout includes.
- 2026-04-23: The current local Jekyll preview already exposes `site.github.build_revision`, so the same shared include logic works both on GitHub Pages and in the repo’s Docker preview without adding a custom config flag.

## Decision Log

- 2026-04-23: Keep the QoL pass inside the existing static page plus worker architecture.
  Reason: The current shortcomings are mostly client-side interaction and presentation problems, not missing backend capability. Solving them in the browser keeps scope tight and avoids speculative server work.
- 2026-04-23: Treat search, filter, sort, persistence, and feedback as one cohesive QoL plan.
  Reason: These issues compound each other in the same browsing flow. Shipping them together produces a noticeably better shopping experience and avoids multiple partial UI rewrites on the same page shell.
- 2026-04-23: Do not assume new Square metadata fields.
  Reason: The existing worker contract is intentionally compact and proven. This plan should improve usability with the data already available instead of widening scope to chase uncertain catalog enrichment.

## Outcomes & Retrospective

Implementation is nearly complete. The current working approach keeps the entire QoL pass inside the existing books-page include, one browser script, and catalog-specific Sass, with one shared button-state polish in `_sass/_components.scss`. Validation evidence now includes passing worker tests, a clean JavaScript syntax check, a clean `git diff --check`, a rebuilt Docker preview, and manual browser confirmation that add-to-cart, reload persistence, and the dialog image viewer work on `/books/`. Commit and push are the remaining steps.

## Change Log

- 2026-04-23: Replaced the template stub with a full execution-ready spec for catalog search, filtering, sorting, persistence, feedback, accessibility, and scanning improvements.
- 2026-04-23: Revised the active plan after review to reflect active status, keep category sorting, define the native-dialog lightbox with raw-image fallback, and simplify cart-recovery expectations for a small low-volume catalog.
- 2026-04-23: Implemented the first code pass for browse controls, cart persistence, add-to-cart simplification, result messaging, responsive catalog styling, and the minimal image lightbox.
- 2026-04-23: Fixed the hidden-state regression discovered in browser validation and moved disabled checkout styling into the shared button primitive.
- 2026-04-23: Updated the stable architecture and ADR docs to capture browser-side cart persistence and live-catalog reconciliation as the durable approach for `/books/`.
- 2026-04-23: Began a follow-up polish pass for empty-cart message clearing, cart-total wording and separation, and sort-only result-count copy.
- 2026-04-23: Completed the follow-up polish pass and revalidated the restored-cart message, item/item summary wording, divider styling, and sort-only result-count copy in the local preview.
- 2026-04-23: Began a second follow-up polish pass to remove the duplicate empty-result announcement from the compact results line.
- 2026-04-23: Began a deployment follow-up to add GitHub Pages-native asset cache busting for shared CSS and JavaScript URLs.
- 2026-04-23: Completed the asset-versioning follow-up by appending a shared revision token to CSS, JS, and favicon URLs, then verified the rendered HTML in the local preview.
