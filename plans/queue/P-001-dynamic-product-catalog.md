# P-001 – Dynamic product catalog

This plan is a self-contained, living document. Keep it usable by a fresh agent with no prior context.

Purpose: describe planned work before execution begins. When execution starts, move this file to plans/active/.

Instructions:
- Explain the user-visible outcome first.
- Keep this file self-contained: include the context needed to execute it without relying on prior chat history.
- Use prose for narrative sections. Use checkboxes only in `Progress`.
- When execution begins, move this file to plans/active/ and keep all sections current as work proceeds.
- When the task is resolved, append a concise outcome to plans/progress.md and move the file to plans/archive/.
- If the plan changes, update affected sections and add a note in `Change Log`.

## Purpose / Big Picture

After this change, a non-technical administrator can add, edit, archive, or reprice items in the Square Seller Dashboard and see those changes reflected immediately on the public Jekyll website. No Git commits, no Jekyll rebuilds, no GitHub Actions runs, and no copy-paste of embed codes are required. A visitor loads the site; a small JavaScript include calls a Cloudflare Worker proxy; the proxy securely reads the live Square Catalog API and returns sanitized product data; the browser renders the catalog into the page DOM.

## Context and Orientation

The site is a Jekyll-generated static site deployed to GitHub Pages. It currently has no dynamic product catalog. Square (not Stripe) is the point-of-sale and payment platform. Because the Square Catalog API requires a secret access token to read items, the token cannot be exposed in client-side JavaScript served by a static host. To solve this without altering the Jekyll build process, we introduce a read-only Cloudflare Worker that stores the Square token as an encrypted secret, queries Square at request time, and returns JSON to the browser. The Jekyll site itself remains purely static; only a single include file adds the runtime fetch behavior <kcite ref="91"/><kcite ref="93"/>.

Key terms:
- **Square Catalog API** – REST API exposing items, variations, images, and pricing stored in the Square item library <kcite ref="47"/><kcite ref="48"/>.
- **Cloudflare Worker** – Serverless edge function that acts as a secure proxy between the public Jekyll site and Square's authenticated API.
- **Jekyll include** – A reusable HTML/JavaScript fragment stored in `_includes/` that can be dropped into any page or layout.

## Scope

- Build, configure, and deploy a Cloudflare Worker that exposes a public `GET` endpoint returning active Square catalog items as JSON.
- Configure CORS on the Worker so only the GitHub Pages origin (or custom domain) can fetch the endpoint <kcite ref="101"/><kcite ref="103"/>.
- Store the Square access token as a Worker secret, never baking it into the Worker script bundle <kcite ref="59"/><kcite ref="120"/>.
- Add a Jekyll include file (`_includes/square-catalog.html`) containing a container `<div>` and a vanilla JavaScript snippet that fetches the Worker and renders product cards.
- Wire the include into the relevant Jekyll layout or page (e.g., `products.md`, `index.html`).
- Add minimal CSS for the injected catalog cards.
- Document rollback procedures and failure modes.

## Deliverables

- `square-catalog-worker/src/index.js` – Worker source code handling CORS, Square authentication, and JSON serialization.
- `square-catalog-worker/wrangler.toml` – Worker configuration metadata.
- `square-catalog-worker/package.json` – Project manifest (if using Wrangler 3 + ES modules).
- `_includes/square-catalog.html` – Jekyll include with the client-side fetch and render logic.
- `_sass/_square-catalog.scss` or equivalent CSS additions – Styling for dynamically injected cards.
- `docs/square-catalog-setup.md` – Runbook for rotating the Square token and redeploying the Worker.
- A live Worker URL responding with the current Square catalog.

## Non-goals

- No changes to the Jekyll build pipeline or GitHub Actions; the site is still built as a standard static site and this catalog loads purely client-side.
- No payment processing, checkout session creation, or order logic in the Worker; it is read-only from Square and does not touch money.
- No Square Online Store subscription, paid Square APIs, or third-party e-commerce platforms; this uses the free standard Catalog API access included with a Square account.
- No server-side rendering of catalog data into Jekyll's Liquid templates at build time; this is explicitly a dynamic runtime integration.

## Interfaces and Dependencies

- **Square Catalog API** – `GET /v2/catalog/list?types=ITEM` (or `POST /v2/catalog/search-catalog-items`) authenticated with `Authorization: Bearer <access_token>` <kcite ref="47"/><kcite ref="48"/><kcite ref="54"/>.
- **Square Seller Dashboard** – The human-facing interface where items, prices, descriptions, and images are maintained.
- **Square access token** – Scoped to `ITEMS_READ` (or broader) generated in the Square Developer Dashboard <kcite ref="111"/><kcite ref="120"/>.
- **Cloudflare Worker / Wrangler CLI** – Deployment target and tooling. Wrangler pushes code and secrets to Cloudflare's edge.
- **GitHub Pages origin** – The Jekyll site's canonical URL, required for the CORS allowlist.
- **Browser `fetch()` and DOM APIs** – Used by `_includes/square-catalog.html` to consume the Worker and inject elements.

## Plan of Work

1. **Provision Square credentials** – Log into the Square Developer Dashboard, create or copy an access token with catalog read permissions, and note the environment (Sandbox vs Production) because the API hostname changes <kcite ref="59"/><kcite ref="120"/>.
2. **Bootstrap the Worker project** – Initialize a new Wrangler project locally. Write `src/index.js` to handle `OPTIONS` preflight, attach CORS headers, read `env.SQUARE_ACCESS_TOKEN`, call Square's `list-catalog` endpoint filtering for `ITEM` objects, extract the first variation's price money, and return a clean JSON array. Deploy with `wrangler deploy`.
3. **Secure the token** – Store the Square access token via `wrangler secret put SQUARE_ACCESS_TOKEN` so it is encrypted and injected at runtime; do not commit it to Git <kcite ref="91"/><kcite ref="93"/>.
4. **Configure CORS** – In the Worker, set `Access-Control-Allow-Origin` to the Jekyll site's exact domain (or a specific allowed origin variable) and handle `OPTIONS` preflight so GitHub Pages can fetch without browser blocks <kcite ref="101"/><kcite ref="103"/>.
5. **Create the Jekyll include** – Add `_includes/square-catalog.html` containing a container `<div id="square-catalog-root"></div>` and an immediately invoked async function that calls the Worker endpoint, iterates the returned items, builds DOM nodes (name, description, price, placeholder for image), and injects them. Include a fallback message on network or parsing errors.
6. **Integrate into the site** – Reference the include in the desired page or layout using `{% include square-catalog.html %}` <kcite ref="121"/><kcite ref="123"/>.
7. **Style the output** – Add CSS rules targeting `.square-product` or similar classes assigned in the JavaScript so the generated cards match the site's existing design language.
8. **Validate end-to-end** – Load the Jekyll site in a browser, confirm the catalog renders, verify in DevTools that the request to the Worker succeeds, archive an item in the Square Dashboard, hard-refresh the site, and confirm the item disappears.

## Concrete Steps

Run on your local macOS machine. Assume Node.js and Wrangler are installed; if Wrangler is missing, install it first:

```bash
npm install -g wrangler
```

Bootstrap the project:

```bash
mkdir -p ~/projects/square-catalog-worker
cd ~/projects/square-catalog-worker
wrangler init --y
```

Replace `src/index.js` with the Worker handler code (see the script in Artifacts and Notes). Then set the secret:

```bash
wrangler secret put SQUARE_ACCESS_TOKEN
```

Type or paste the Square access token when prompted. Then deploy:

```bash
wrangler deploy
```

Copy the published Worker URL from the terminal output (e.g., `https://square-catalog-worker.your-account.workers.dev`).

On the Jekyll repository, create `_includes/square-catalog.html` with the HTML/JS snippet from Artifacts and Notes. Update the `WORKER_URL` constant inside the script to match the deployed URL.

In your Jekyll page or layout where the catalog should appear, add:

```liquid
{% include square-catalog.html %}
```

Commit and push those Jekyll changes to GitHub. GitHub Pages will deploy normally. Because the catalog loads dynamically, no Jekyll rebuild is needed when Square data changes.

## Validation and Acceptance

- **Worker response**: `curl -H "Origin: https://your-jekyll-domain" https://your-worker.workers.dev/` returns HTTP 200 and a JSON array where each element contains `id`, `name`, `description`, `price_cents`, and `price_display`.
- **Browser network tab**: No CORS policy errors; the request shows 200 OK and the response body is readable JSON.
- **DOM inspection**: The `#square-catalog-root` container contains one child element per active Square item.
- **Square Dashboard smoke test**: Archive an item in Square, wait 5 seconds, hard-refresh the Jekyll page; the archived item is no longer rendered.
- **Graceful degradation**: If the Worker returns 500 or the browser is offline, the container displays the text "Catalog temporarily unavailable." instead of throwing an unhandled exception or leaving a blank void.

## Idempotence and Recovery

- **Redeploying the Worker**: Running `wrangler deploy` from the project directory is idempotent. It overwrites the previous deployment without affecting the stored secret. If the new code is broken, roll back by deploying the last known-good commit or by editing the script directly in the Cloudflare Dashboard.
- **Disabling the catalog**: Remove the `{% include square-catalog.html %}` tag from the Jekyll layout and push. The site reverts to a static page with no catalog fetch logic. No Worker teardown is required.
- **Rotating credentials**: If the Square token is revoked, generate a new one in the Square Developer Dashboard and rerun `wrangler secret put SQUARE_ACCESS_TOKEN`. No code changes are necessary.
- **Partial failure**: The client-side JavaScript wraps the fetch in a `try/catch`. If the Worker is unreachable, the catch block renders the fallback message, leaving the rest of the page untouched.

## Milestones

- **M1 – Worker deployed**: The Worker URL returns a valid JSON array of active Square items when requested via `curl`. Proof: terminal output showing parsed JSON.
- **M2 – CORS passing**: A browser request from the GitHub Pages domain succeeds without CORS errors. Proof: DevTools Network tab showing status 200 and no console warnings.
- **M3 – Frontend rendering**: The Jekyll page displays styled product cards reflecting the current Square Dashboard state. Proof: DOM contains `.square-product` nodes with correct text content.
- **M4 – Live update confirmed**: Changing an item's name or price in the Square Dashboard and reloading the Jekyll page reflects the change within seconds. Proof: before/after screenshot or `curl` comparison.

## Pre-execution User Q&A

Before executing this plan, confirm the following:

1. **Square environment**: Are we targeting the Square Sandbox (`connect.squareupsandbox.com`) or Production (`connect.squareup.com`) catalog? This determines the API hostname in the Worker.
2. **Site origin**: What is the exact GitHub Pages URL or custom domain serving the Jekyll site? This value must be hardcoded into the Worker's CORS allowlist.
3. **Item variations**: Do your Square items use variations (e.g., size/color), or are they simple single-price items? If variations are used, we need to decide whether to show the lowest price, a price range, or list each variation as a separate card.
4. **Images**: Are product images uploaded to Square's catalog? Square stores images as separate `CATALOG_IMAGE` objects; fetching image URLs requires either including `IMAGE` in the catalog list query and mapping `image_id` references, or accepting a text-only catalog in the first iteration.
5. **Purchase action**: Should each product card link to an existing Square Payment Link, a generic contact form, or is the catalog display-only with no click-through action required?

## Progress for AI coding agent

- [ ] Initialize Cloudflare Worker project with `wrangler init` and configure `wrangler.toml`
- [ ] Write `src/index.js` that handles `OPTIONS` preflight, reads `SQUARE_ACCESS_TOKEN` from `env`, calls Square `GET /v2/catalog/list?types=ITEM`, extracts the first variation’s price money, and returns sanitized JSON with `Access-Control-Allow-Origin` headers
- [ ] Deploy the Worker with `wrangler deploy` and capture the published Worker URL
- [ ] Create `_includes/square-catalog.html` with a `<div id="square-catalog-root"></div>` and an async IIFE that fetches the Worker endpoint, maps the JSON array to DOM nodes (name, description, price), handles network or parsing errors gracefully, and runs on `DOMContentLoaded`
- [ ] Add CSS rules targeting `.square-product`, `.square-product-name`, `.square-product-price`, and `.square-product-desc` to match the site’s existing design
- [ ] Insert `{% include square-catalog.html %}` into the target Jekyll page or layout
- [ ] Write `docs/square-catalog-setup.md` runbook covering Worker URL, secret rotation procedure, and rollback steps
- [ ] Any missing tasks?

## Human backlog

- [ ] Confirm Square environment (Sandbox vs Production) and generate a Square access token with catalog read permissions in the Square Developer Dashboard
- [ ] Provide the Jekyll site’s exact origin URL (GitHub Pages or custom domain) for the Worker’s CORS allowlist
- [ ] Run `wrangler secret put SQUARE_ACCESS_TOKEN` in the Worker project directory to encrypt and store the Square token at Cloudflare
- [ ] Verify at least one active item with a priced variation exists in the Square Seller Dashboard Catalog
- [ ] Communicate the desired handling of item variations (first variation only, lowest price, price range, or separate cards) and whether product images are required
- [ ] Archive an item in the Square Dashboard, hard-refresh the public Jekyll page, and confirm the item disappears without a GitHub Actions rebuild
- [ ] Review rendered product cards in browser and approve styling or request adjustments

## Surprises & Discoveries

- *(To be recorded during execution.)*

## Decision Log

- *(To be recorded during execution.)*

## Outcomes & Retrospective

- *(To be filled upon completion.)*

## Artifacts and Notes

### Cloudflare Worker handler (`src/index.js`)

(Example only; final code TBD.)

```javascript
export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const squareUrl = "https://connect.squareup.com/v2/catalog/list?types=ITEM";
    const squareRes = await fetch(squareUrl, {
      headers: {
        "Authorization": `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!squareRes.ok) {
      return new Response(JSON.stringify({ error: "Square API error" }), {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
        },
      });
    }

    const data = await squareRes.json();
    const items = (data.objects || []).map((obj) => {
      const item = obj.item_data || {};
      const variations = item.variations || [];
      const firstVar = variations[0]?.item_variation_data || {};
      const priceMoney = firstVar.price_money || {};
      return {
        id: obj.id,
        name: item.name,
        description: item.description,
        price_cents: priceMoney.amount || null,
        price_display: priceMoney.amount
          ? `$${(priceMoney.amount / 100).toFixed(2)}`
          : null,
      };
    }).filter((i) => i.price_cents !== null);

    return new Response(JSON.stringify(items), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowedOrigin,
      },
    });
  },
};
```

### Jekyll include (`_includes/square-catalog.html`)

(Example only; final code TBD.)

```html
<div id="square-catalog-root">
  <p>Loading catalog…</p>
</div>
<script>
(function () {
  const WORKER_URL = "https://REPLACE-WITH-YOUR-WORKER.workers.dev";
  const container = document.getElementById("square-catalog-root");

  async function loadCatalog() {
    try {
      const res = await fetch(WORKER_URL);
      if (!res.ok) throw new Error("Network response was not ok");
      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = "<p>No products available.</p>";
        return;
      }
      const html = items.map((item) => {
        const name = item.name ? item.name.replace(/</g, "&lt;") : "";
        const desc = item.description ? item.description.replace(/</g, "&lt;") : "";
        const price = item.price_display || "";
        return `<article class="square-product">
          <h3 class="square-product-name">${name}</h3>
          <p class="square-product-price">${price}</p>
          ${desc ? `<p class="square-product-desc">${desc}</p>` : ""}
        </article>`;
      }).join("");
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = "<p>Catalog temporarily unavailable.</p>";
      console.error(e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadCatalog);
  } else {
    loadCatalog();
  }
})();
</script>
```

## Change Log

- 2026-04-22: Initial draft created.

[^1]: [CORS header proxy · Cloudflare Workers docs](https://developers.cloudflare.com/workers/examples/cors-header-proxy/) (21%)
[^2]: [Includes | Jekyll • Simple, blog-aware, static sites](https://jekyllrb.com/docs/includes/) (17%)
[^3]: [How to include a javascript from /js/ in jekyll - Stack Overflow](https://stackoverflow.com/questions/61371099/how-to-include-a-javascript-from-js-in-jekyll) (13%)
[^4]: [Secrets - Workers - Cloudflare Docs](https://developers.cloudflare.com/workers/configuration/secrets/) (11%)
[^5]: [Environment variables · Cloudflare Workers docs](https://developers.cloudflare.com/workers/configuration/environment-variables/) (10%)
[^6]: [Access Tokens and Other Credentials - Square Developer](https://developer.squareup.com/docs/build-basics/access-tokens) (10%)
[^7]: [Catalog API - Square API Reference](https://developer.squareup.com/reference/square/catalog-api) (9%)
[^8]: [GET /v2/catalog/list - Square API Reference](https://developer.squareup.com/reference/square/catalog-api/list-catalog) (4%)
[^9]: [Adding CORS headers · Cloudflare Pages docs](https://developers.cloudflare.com/pages/functions/examples/cors-headers/) (4%)
[^10]: [Authentication - Square Developer](https://developer.squareup.com/docs/auth) (1%)
