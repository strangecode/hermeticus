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
