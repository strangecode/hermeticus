# Hermeticus Bookshop

A simple static website for Hermeticus Bookshop, built with
[Jekyll](https://jekyllrb.com/) and deployed to GitHub Pages.

> **Contributing (humans and coding agents):** read
> [`AGENTS.md`](./AGENTS.md) before making any change. It defines the
> conventions, accessibility rules, and design-token system that keep the
> site consistent as it grows.

## Local preview

Prerequisite: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```sh
docker compose up --build
```

Open the Jekyll preview at <http://127.0.0.1:4000/> and use that exact address instead of `http://localhost:4000`, which the catalog Worker does not allow. The preview rebuilds when files change. Ruby and the required gems stay inside the Docker image instead of being installed on the host.

```sh
docker compose down
```

Run the final command from another terminal to stop the preview.

## Project layout

```
_config.yml       Jekyll configuration
_data/            Site data (navigation, etc.)
_includes/        HTML partials (head, header, footer)
_layouts/         Page templates (default, page, home)
assets/css/       Design tokens and stylesheets
assets/js/        Progressive-enhancement JavaScript
pages/            Content pages authored in Markdown
index.md          Home page
404.html          Not-found page
AGENTS.md         Contributor guide (read this first)
```

## Deployment

This repository is configured so GitHub Pages builds Jekyll automatically
from the default branch &mdash; no CI/CD pipeline is required.

The Square catalog Worker is deployed separately through Wrangler:

```sh
npm --prefix integrations/square-catalog-worker run deploy
```

Non-interactive deploys require `CLOUDFLARE_API_TOKEN` in the environment.

## Shipping prices

The Worker calculates shipping from [`integrations/square-catalog-worker/shipping-rates.json`](./integrations/square-catalog-worker/shipping-rates.json). Money values in that file are US cents. To change the prices, edit the JSON, run the Worker tests, and redeploy:

```sh
npm test --prefix integrations/square-catalog-worker
npm --prefix integrations/square-catalog-worker run deploy
```

The `perItemRatesCents` table applies to products without a weight. Quantities 25 and higher use `25+`. Products with a weight use `weightRateCentsPerPound`; the minimum and free-shipping thresholds are defined alongside it. Mixed carts use the higher applicable result.

Square does not expose its built-in Dashboard weight through the Catalog API. To give the Worker a product weight:

1. In Square Dashboard, open **Items & services → Custom attributes** and create a **Number** attribute named exactly `Shipping weight (lb)`.
2. Edit the item or its variation and add the weight in pounds under **Custom attributes**. A variation value takes priority over an item value.
3. Leave the attribute empty for normal per-item book rates. Set it to `0.1` for free-shipping products such as postcards. Set a larger value when the product should use weight-based shipping.

The public catalog reports this value as `w`; missing or invalid weights report `null`. The native Square **Weight** field can still be maintained for Square Online, but it does not affect this Worker.
