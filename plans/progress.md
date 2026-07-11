# Progress

Purpose: record concise historical outcomes as work progresses, including partial completions, completed work, abandoned work, and reversions.

Instructions:
- Append one short entry per meaningful outcome to the bottom of this file.
- Use this file to capture what happened, why it happened, and any important follow-up.
- Record meaningful progress as it occurs; do not wait for final user confirmation to update this file.
- Capture the reason for reversions, abandoned work, or other significant changes in direction.
- Keep this as the durable narrative that git history usually fails to explain cleanly.
- Do not copy full plan contents here; summarize outcomes and consequences only.

Suggested entry format:

```md
## YYYY-MM-DD – P-xxx – slug – [partial|completed|abandoned|reverted]
- summary: one or two sentences
- reason: why this outcome happened
- follow-up: optional next step or consequence
```

---

## 2026-04-22 – P-001 – dynamic-square-catalog – partial
- summary: Activated `P-001` and rewrote it into an execution-ready v1 centered on a repo-owned Cloudflare Worker, cached public catalog JSON, and Square-hosted multi-item checkout.
- reason: The queued draft had unresolved product decisions, off-repo paths, and contradictory CORS and API assumptions that would have made implementation unreliable.
- follow-up: Build the worker and replace the `/books/` placeholder with the live catalog UI.

## 2026-04-22 – P-001 – dynamic-square-catalog – partial
- summary: Implemented the worker, the `/books/` catalog UI, the cart flow, and the deployment runbook. Worker tests pass locally.
- reason: The selected v1 architecture was stable enough to build after the plan rewrite.
- follow-up: Deploy the worker with real Square and Cloudflare credentials, set `_config.yml` `square_catalog_api_base`, and rerun end-to-end validation in an environment with Ruby >= 3.0 for local Jekyll builds.

## 2026-04-22 – P-001 – dynamic-square-catalog – partial
- summary: Added a Docker-based local preview workflow with `Dockerfile`, `docker-compose.yml`, and a dedicated Jekyll startup script so the site can be served without depending on host Ruby setup.
- reason: Host Ruby compatibility issues made direct local Jekyll preview noisy and brittle even though production deploys were already working.
- follow-up: Run `docker compose up --build` from the repo root and verify the containerized preview at `http://127.0.0.1:4000/`.

## 2026-04-22 – P-001 – dynamic-square-catalog – partial
- summary: Updated the lockfile to the current GitHub Pages gemset, validated the worker tests, and confirmed `bundle exec jekyll build` succeeds inside Docker without the crashing LiveReload path.
- reason: The original lockfile pinned an older Jekyll/Liquid stack that was incompatible with modern Ruby and unstable in the first containerized preview attempt.
- follow-up: Keep the plan active until you decide the work is complete and want it archived.

## 2026-04-22 – P-001 – dynamic-square-catalog – partial
- summary: Tightened the catalog UI so the loading callout disappears after a healthy load, the books page can use the full container width, and the cart reads as a separate sticky sidebar instead of another product card.
- reason: Live review surfaced a stale success-state bug and showed that the shared prose wrapper was squeezing the catalog and making the cart visually blend into the product grid.
- follow-up: Rebuild the site, verify the `/books/` layout at desktop and mobile widths, then commit and push once the UI looks right.

## 2026-04-22 – P-001 – dynamic-square-catalog – reverted
- summary: Reverted the empty-cart hiding and mobile cart reordering change, restoring the prior sidebar behavior.
- reason: In practice the cart was not disappearing cleanly and the result was worse than the previous layout.
- follow-up: If empty-cart hiding is still wanted later, rework it with a layout approach that removes the sidebar from flow instead of just pushing it below the catalog.

## 2026-04-22 – P-001 – dynamic-square-catalog – partial
- summary: Replaced placeholder home-page and about-page copy with language synthesized from visitor reviews, and updated the home hero to sound more like the shop people describe.
- reason: The site still had placeholder marketing text even after the catalog and layout work was in place.
- follow-up: Publish this content update with the catalog UI polish so the site reads consistently across the home, books, about, and visit pages.

## 2026-04-23 – P-002 – catalog-qol-improvements – partial
- summary: Reviewed the active catalog QoL plan against the live repo, then revised it in place so it reflects active status, keeps category sorting, defines a native-dialog lightbox with raw-image fallback, and simplifies cart-recovery behavior for the shop’s low-volume workflow.
- reason: The existing active plan still contained queued-plan language and did not fully describe the approved lightbox and recovery scope.
- follow-up: Implement the revised browse controls, cart persistence, image viewing, and feedback changes on `/books/`, then validate them in worker tests and the local Jekyll preview.

## 2026-04-23 – P-002 – catalog-qol-improvements – partial
- summary: Reworked `/books/` around explicit search, category, and sort controls; persisted the cart in browser storage; simplified add-to-cart to one-click defaults; and added a minimal dialog-based image viewer that falls back to the raw image link.
- reason: The existing catalog flow was functional but still felt like a first technical pass, especially around browsing, cart continuity, and image viewing.
- follow-up: Run worker tests and local preview validation, update durable docs for client-side cart persistence if the behavior remains as implemented, then publish to `main`.

## 2026-04-23 – P-002 – catalog-qol-improvements – partial
- summary: Validated the refreshed `/books/` flow in Docker and a local browser, fixed a hidden-state regression discovered during that pass, and updated the durable docs to treat browser-side cart persistence as part of the stable catalog architecture.
- reason: The first browser pass exposed one real UI regression and confirmed that cart continuity now changes the stable shape of the books page.
- follow-up: Commit and push the validated change set to `main`, then wait for the GitHub Pages deploy to publish.

## 2026-04-23 – P-002 – catalog-qol-improvements – partial
- summary: Applied a small post-deploy polish to the cart and results copy so restored carts no longer show the empty-state prompt, cart totals now read `item/items` with a divider, and sort-only changes keep the “showing all” wording.
- reason: Live review surfaced three small copy and presentation regressions that were easier to fix in one follow-up pass than leave in production.
- follow-up: Publish the polish commit to `main` and leave the plan active until you confirm the overall work is complete.

## 2026-04-23 – P-002 – catalog-qol-improvements – partial
- summary: Removed the duplicate empty-result announcement by blanking the compact results line whenever the dedicated empty-state callout is shown.
- reason: The books page was saying “No books match…” twice for the same no-results state.
- follow-up: Publish this small follow-up fix to `main` and keep the plan active until you confirm the full catalog polish is done.

## 2026-04-23 – P-002 – catalog-qol-improvements – partial
- summary: Started a deployment-focused follow-up to add GitHub Pages-native cache-busting query strings to shared asset URLs after a normal reload kept serving old CSS.
- reason: A push to `main` deployed correctly, but the browser reused the prior stylesheet until a forced refresh.
- follow-up: Update the shared head and layout includes to append a build-specific revision token, validate the rendered asset URLs locally, then publish to `main`.

## 2026-04-23 – P-002 – catalog-qol-improvements – partial
- summary: Added GitHub Pages-native asset versioning by appending a shared revision token to the site CSS, JavaScript, and favicon URLs from the shared layout includes.
- reason: Normal reloads could keep using stale assets after a deploy even though the new site build was live.
- follow-up: Publish the include changes to `main`, then verify that a fresh deploy serves changed asset URLs without requiring a forced refresh.

## 2026-04-23 – P-002 – catalog-qol-improvements – completed
- summary: Archived `P-002` after user review confirmed the catalog QoL work is complete.
- reason: The browsing controls, cart persistence, image lightbox, post-review polish, and asset cache-busting fixes were implemented, validated, committed, and pushed.
- follow-up: No immediate P-002 work remains. Future catalog changes should start from a new plan or a targeted follow-up request.

## 2026-07-10 – P-003 – events-page – completed
- summary: Replaced the `/events/` placeholder with a data-driven listing sourced from a new `_data/events.yml`, added an `.event-card` component to `_sass/_components.scss` with a responsive photo/text media layout, and seeded the first event (Open Mike Poetry Reading, 2026-07-17). Build and desktop/mobile layouts validated via headless Chromium.
- reason: The user asked to add the poetry reading event and design the events page in the site's existing style.
- follow-up: The event photo arrived only as a chat preview, not a saved file, so `image`/`image_alt` are pre-wired but commented out in `_data/events.yml`. When the file is provided, save it to `assets/images/open-mike-poetry-reading.jpg` and uncomment those two lines to enable the two-column media layout.

## 2026-07-10 – P-003 – events-page – completed
- summary: Processed the Open Mike photo the user dropped in `inbox/` (1536x1024 JPEG): resized to 1200x800 and re-encoded as an optimized progressive JPEG (542KB → 191KB) with Pillow, saved it to `assets/images/open-mike-poetry-reading.jpg`, enabled the `image`/`image_alt` fields in `_data/events.yml`, and cleared the inbox. The event card now renders the two-column photo layout, verified via headless Chromium.
- reason: The `inbox/` workflow (documented in AGENTS.md) is how the nontechnical user hands over raw files; the earlier blocker was that chat-attached images never reach disk, which the inbox solves.
- follow-up: None. To swap the photo later, drop a new file in `inbox/`, re-run the resize, and replace `assets/images/open-mike-poetry-reading.jpg`.

## 2026-07-10 – P-004 – dynamic-event-scheduling – completed
- summary: Made the Events page scheduling dynamic as progressive enhancement. Extracted the card to `_includes/event-card.html`, rewrote `pages/events.md` to render build-time Upcoming/Past sections (30-day retention), and added a self-guarded IIFE to `assets/js/main.js` that re-buckets events by the visitor's current date (past the day after the event date, hidden after 30 days), sorts each list, and toggles section/empty-state visibility. Added section spacing and a `[hidden]` safety rule in `_sass/_components.scss`.
- reason: On a static Jekyll site the build-time split goes stale between deploys; JS keeps Upcoming/Past correct on every visit while the no-JS baseline still works.
- follow-up: The retention window lives in two synced places — `retention_days` in `pages/events.md` and `data-events-retention-days` on the wrapper; keep them equal. Categorization logic is duplicated in Liquid (build) and JS (runtime) by design.

## 2026-07-10 – P-005 – complete-shippable-square-checkout – partial
- summary: Added red-first coverage and implementation for a guarded $5.00 US flat shipping charge, required address collection and US-policy confirmation on Square, disclosed the rate in the cart, documented manual fulfillment, and deployed the Worker. A production checkout confirmed the shipping line, required fields, and total without payment.
- reason: Address collection alone did not calculate or charge shipping, and paid payment-link fulfillments require an explicit seller workflow.
- follow-up: Archive P-005 after user confirmation.
