# P-004 – Dynamic Event Scheduling

## Purpose / Big Picture

The Events page listed events under a static "Upcoming" heading. On a static
Jekyll site the build only happens at deploy, so an event's date would go stale
between deploys. This plan makes the split dynamic on the client: an event moves
from Upcoming to Past the day after its scheduled date, Past events remain
listed for a 30-day retention window, and older events are hidden — all without
a rebuild, and without breaking the no-JavaScript baseline.

## Context and Orientation

- Events are data-driven from `_data/events.yml`, rendered by `pages/events.md`.
- `assets/js/main.js` is loaded globally (`_layouts/default.html`, `defer`) and
  is reserved for progressive enhancement. It is a set of self-guarding IIFEs;
  the existing one early-returns unless `[data-catalog-root]` is present.
- The site must remain fully usable with JavaScript disabled (AGENTS.md).
- `_config.yml` sets `timezone: Etc/UTC`, so build-time date math is in UTC.

## Scope

- Factor the event card markup into `_includes/event-card.html` (used by both
  the Upcoming and Past loops; DRY).
- Rewrite `pages/events.md` to render two sections — Upcoming and Past — split
  at BUILD time by `site.time`, with a 30-day retention cutoff, plus data hooks
  (`data-events`, `data-events-list`, `data-events-section`, `data-event-date`,
  `data-events-retention-days`) and empty-state handling.
- Add a second, self-guarded IIFE to `assets/js/main.js` that, on each visit,
  re-buckets events by the visitor's LOCAL current date, hides events older than
  the retention window, sorts each list, and toggles section/empty-state
  visibility.
- Add minimal CSS in `_sass/_components.scss`: spacing between the two sections
  and a `[hidden]` safety rule so hidden items leave the grid flow.

## Design decisions

- **Progressive enhancement.** Jekyll renders a correct split at build time
  (no-JS users get a sensible, deploy-fresh view); JS refines it to the current
  date at view time. The categorization logic is intentionally duplicated in
  Liquid (build) and JS (runtime); keep the two in sync.
- **Day-granularity, local time.** Event dates are parsed as LOCAL midnight
  (`new Date(y, m-1, d)`) to avoid the UTC off-by-one that `new Date("YYYY-MM-DD")`
  causes. "Past" begins when `floor((todayMidnight - eventDate)/day) >= 1`.
- **Retention.** Shown in Past while `daysSince <= 30`; hidden at 31+. The window
  lives in one place per surface: `data-events-retention-days` on the wrapper
  (JS) and `retention_days` in `pages/events.md` (build); keep them equal.
- **No framework, no new file.** The behavior is one small IIFE appended to the
  existing global script, guarded by its own container so it no-ops elsewhere.

## Validation and Acceptance

- `jekyll build` completes without warnings; `node --check assets/js/main.js`
  passes.
- Build-time render places the seeded 2026-07-17 event under Upcoming, with the
  Past section and the upcoming empty-state `hidden`.
- A headless-browser test with events at today, +7, −1, −15, −30, and −31 days
  confirms: today/+7 → Upcoming (soonest first); −1/−15/−30 → Past (most recent
  first); −31 → hidden; Past section revealed; upcoming empty-state hidden.
- With JS disabled, the build-time split remains correct and usable.

## Outcomes & Retrospective

Implemented and validated as planned. The event card was extracted to
`_includes/event-card.html`; `pages/events.md` now renders build-time Upcoming
and Past sections; `assets/js/main.js` gained a self-guarded events IIFE; and
`_sass/_components.scss` got section spacing plus a `[hidden]` safety rule. The
headless-Chromium test passed every boundary case (day 0 upcoming, day 1 past,
day 30 shown, day 31 hidden), and the live single-event page rendered correctly
with JS active and no console errors.

## Change Log

- 2026-07-10: Added client-side dynamic Upcoming/Past scheduling with a 30-day
  retention window as progressive enhancement over a build-time split.
