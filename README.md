# Hermeticus Bookshop

A simple static website for Hermeticus Bookshop, built with
[Jekyll](https://jekyllrb.com/) and deployed to GitHub Pages.

> **Contributing (humans and coding agents):** read
> [`AGENTS.md`](./AGENTS.md) before making any change. It defines the
> conventions, accessibility rules, and design-token system that keep the
> site consistent as it grows.

## Local preview

Prerequisites: Ruby &ge; 3.1 and [Bundler](https://bundler.io/).

```sh
bundle install
bundle exec jekyll serve --livereload
```

The site is then available at <http://127.0.0.1:4000/>.

## Local preview with Docker

If you do not want Ruby and gems installed into your host environment, use the
repo-local Docker setup instead.

```sh
npm run docker:up
```

The Jekyll preview is then available at <http://127.0.0.1:4000/> and
the site rebuilds on file changes.

The compose setup bind-mounts the repo source into the container, while Ruby
and gems are baked into the image instead of your host environment.

If you change `Gemfile` or `Gemfile.lock`, rebuild the image:

```sh
npm run docker:up
```

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
