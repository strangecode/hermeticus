---
layout: page
title: Events
description: Upcoming readings, signings, and gatherings at Hermeticus Bookshop.
permalink: /events/
subtitle: Readings, signings, and gatherings for Ashland&rsquo;s book-loving community.
body_class: events
disable_prose: true
---

{%- comment -%}
  Events are split into Upcoming and Past. Jekyll renders a correct split at
  BUILD time here; assets/js/main.js refines it to the visitor's CURRENT date
  on each visit (an event moves to Past the day after its date, and Past events
  are hidden once older than the retention window). Keep the retention window
  below in sync with data-events-retention-days on the wrapper.
{%- endcomment -%}
{%- assign retention_days = 30 -%}
{%- assign sorted = site.data.events | sort: "date" -%}
{%- assign today_s = site.time | date: "%Y-%m-%d" | date: "%s" | plus: 0 -%}
{%- assign cutoff_s = today_s | minus: 2592000 -%}

{%- assign upcoming_count = 0 -%}
{%- assign past_count = 0 -%}
{%- for event in sorted -%}
  {%- assign ev_s = event.date | date: "%s" | plus: 0 -%}
  {%- if event.recurs or ev_s >= today_s -%}
    {%- assign upcoming_count = upcoming_count | plus: 1 -%}
  {%- elsif ev_s >= cutoff_s -%}
    {%- assign past_count = past_count | plus: 1 -%}
  {%- endif -%}
{%- endfor -%}

<div class="events-schedule" data-events data-events-retention-days="{{ retention_days }}">
  <section aria-labelledby="upcoming-heading" data-events-section="upcoming">
    <h2 id="upcoming-heading" class="section__title">Upcoming</h2>
    <ul class="event-list" role="list" data-events-list="upcoming">
      {%- for event in sorted -%}
        {%- assign ev_s = event.date | date: "%s" | plus: 0 -%}
        {%- if event.recurs or ev_s >= today_s -%}{% include event-card.html event=event %}{%- endif -%}
      {%- endfor -%}
    </ul>
    <p class="events-empty" data-events-empty="upcoming"{% if upcoming_count != 0 %} hidden{% endif %}>
      No upcoming events are on the calendar just now. Please <a href="{{ '/contact/' | relative_url }}">get in touch</a> to hear about what&rsquo;s coming next.
    </p>
  </section>

  <section aria-labelledby="past-heading" data-events-section="past"{% if past_count == 0 %} hidden{% endif %}>
    <h2 id="past-heading" class="section__title">Past events</h2>
    <ul class="event-list event-list--past" role="list" data-events-list="past">
      {%- assign recent_first = sorted | reverse -%}
      {%- for event in recent_first -%}
        {%- assign ev_s = event.date | date: "%s" | plus: 0 -%}
        {%- if event.recurs == nil and ev_s < today_s and ev_s >= cutoff_s -%}{% include event-card.html event=event %}{%- endif -%}
      {%- endfor -%}
    </ul>
  </section>
</div>
