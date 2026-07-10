# P-003 – Events Page

## Purpose / Big Picture

The `/events/` page was a placeholder ("_No events listed yet._"). This plan
turns it into a real, data-driven events listing consistent with the rest of
the site, and adds the shop's first event: the Open Mike Poetry Reading on
2026-07-17. After this work, adding or removing an event is a one-file edit in
`_data/events.yml`; the page renders each event as a card that matches the
existing design language.

## Context and Orientation

- The site is a static Jekyll site; visual decisions flow through
  `_sass/_tokens.scss` and reusable components live in `_sass/_components.scss`.
- Navigation already follows a data-driven pattern via `_data/navigation.yml`.
  Events adopt the same approach for a single source of truth.
- The `page` layout wraps content in `.prose` (max-width 40rem) unless
  `disable_prose: true` is set in front matter; the events grid needs the wider
  container, so it opts out of prose.

## Scope

- Add `_data/events.yml` as the single source of truth for events, with inline
  documentation of each field.
- Rewrite `pages/events.md` to sort events by date and render each as a card
  with an optional photo, formatted date/time, location, cost, and description.
- Add an `.event-card` component to `_sass/_components.scss` using only design
  tokens, with a responsive media layout (photo beside details on wide screens,
  stacked on narrow) that degrades to a clean text-only card when no photo is
  present.
- Seed the first event (Open Mike Poetry Reading, 2026-07-17, 7:00 pm).

## Non-goals

- No past-events archive yet; the page shows upcoming events only.
- No calendar feed, RSVP, or ticketing.
- No new dependency, plugin, or JavaScript. The page is fully static.

## Accessibility

- One `<h1>` (from the layout), `<h2>` section heading, `<h3>` per event — no
  skipped levels.
- Events are a semantic list; each photo has descriptive `alt` text.
- Colors and type reuse existing token pairings that already meet WCAG AA.

## Validation and Acceptance

- `jekyll build` completes without warnings.
- `/events/` renders the seeded event with correctly formatted date
  ("Friday, July 17, 2026"), location, cost, and description.
- The card layout is verified at desktop and mobile widths, with and without a
  photo.
- `_data/events.yml` is the only file that needs editing to change events.

## Outcomes & Retrospective

Implemented as planned. The events page is now data-driven via
`_data/events.yml` and the new `.event-card` component in
`_sass/_components.scss`. The build was validated with a UTF-8 locale
(`RUBYOPT=-EUTF-8`) because the sandbox defaults to US-ASCII, which the sass
gem otherwise rejects on the existing non-ASCII comment in `_tokens.scss`;
GitHub Pages builds under UTF-8 and is unaffected. The Open Mike Poetry Reading
event is live as a text card. The event's photograph was provided only as a
chat preview, not a file the agent could save, so the `image`/`image_alt`
fields are pre-wired but commented out in `_data/events.yml`; dropping the file
into `assets/images/open-mike-poetry-reading.jpg` and uncommenting those two
lines renders the two-column media layout with no further changes.

## Change Log

- 2026-07-10: Added the data-driven events page, the `.event-card` component,
  and the first Open Mike Poetry Reading event.
