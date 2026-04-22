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
