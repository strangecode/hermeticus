# Architectural Decisions

Purpose: keep a concise durable rationale log for technical decisions, tradeoffs, and reusable lessons that should survive beyond one task.

Instructions:
- Append entries to the bottom of this file.
- Record decisions that are likely to matter again.
- Include the context, the decision, and the consequences or tradeoffs.
- Use this file for durable reasoning, not temporary task notes.
- Promote non-obvious lessons here when they are too important to leave only in planning files.
- Do not log technical details that belong in git commit messages.

Format each ADR as four concise lines:

```md
## YYYY-MM-DD – Short decision title
Context: what problem or constraint existed
Decision: what was chosen
Consequences: tradeoffs, risks, or follow-on effects
```

---

## 2026-04-22 – Use a Cloudflare Worker between Jekyll and Square
Context: GitHub Pages is static, but the books page needs live catalog data and server-side checkout creation without exposing Square credentials.
Decision: Keep the site static and add a repo-owned Cloudflare Worker as the only component allowed to talk to Square.
Consequences: The worker adds one deploy target and one secret store, but it keeps secrets out of git and avoids adding a full custom backend.

## 2026-04-22 – Use Square-hosted checkout for the first online purchase flow
Context: The site needs a secure payment flow with the least custom payment surface and should ideally support buying more than one book at a time.
Decision: Create Square-hosted payment links from the worker using a validated multi-item order and redirect buyers to Square for payment.
Consequences: Checkout UX lives partly off-site on Square, but the implementation is simpler, more secure, and supports carts without handling card fields locally.

## 2026-04-22 – Publish only single-variation items with tracked stock
Context: The first version should avoid ambiguous pricing and availability while still supporting one-of-a-kind books and low-volume stock.
Decision: Show only items that have exactly one sellable variation, a positive price, and positive tracked inventory at one configured Square location.
Consequences: Sellers must keep inventory tracking enabled for books they want online, and multi-variation items are intentionally excluded until a later revision.

## 2026-04-23 – Keep cart continuity client-side and disposable
Context: The books page needed a more forgiving shopping flow, but this site remains a static Jekyll frontend with a tiny low-volume catalog and no appetite for extra backend state.
Decision: Persist the cart only in browser `localStorage`, reconcile it against the latest live catalog on load, and silently discard invalid saved lines instead of introducing server-side cart storage or elaborate recovery flows.
Consequences: Buyers keep their place across reloads with minimal implementation complexity, but cart state remains device-local and should always be treated as convenience state rather than authoritative inventory state.
