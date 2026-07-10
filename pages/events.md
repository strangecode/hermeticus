---
layout: page
title: Events
description: Upcoming readings, signings, and gatherings at Hermeticus Bookshop.
permalink: /events/
subtitle: Readings, signings, and gatherings for Ashland&rsquo;s book-loving community.
body_class: events
disable_prose: true
---

{%- assign upcoming = site.data.events | sort: "date" -%}
{%- if upcoming.size > 0 -%}
<section aria-labelledby="upcoming-heading">
  <h2 id="upcoming-heading" class="section__title">Upcoming</h2>
  <ul class="event-list" role="list">
    {%- for event in upcoming -%}
    <li>
      <article class="event-card{% if event.image %} event-card--media{% endif %}">
        {%- if event.image -%}
        <figure class="event-card__media">
          <img
            class="event-card__image"
            src="{{ event.image | relative_url }}"
            alt="{{ event.image_alt | default: event.title | strip }}"
            loading="lazy">
        </figure>
        {%- endif -%}
        <div class="event-card__body">
          <p class="event-card__when">
            <time datetime="{{ event.date | date: '%Y-%m-%d' }}">{{ event.date | date: "%A, %B %-d, %Y" }}</time>{% if event.time %}<span class="event-card__time"> &middot; {{ event.time }}</span>{% endif %}
          </p>
          <h3 class="event-card__title">{{ event.title }}</h3>
          {%- if event.location or event.cost -%}
          <ul class="event-card__meta" role="list">
            {%- if event.location -%}<li>{{ event.location }}</li>{%- endif -%}
            {%- if event.cost -%}<li>{{ event.cost }}</li>{%- endif -%}
          </ul>
          {%- endif -%}
          {%- if event.description -%}<p class="event-card__description">{{ event.description | strip }}</p>{%- endif -%}
        </div>
      </article>
    </li>
    {%- endfor -%}
  </ul>
</section>
{%- else -%}
<p class="events-empty">No events are on the calendar just now. Please <a href="{{ '/contact/' | relative_url }}">get in touch</a> to hear about what&rsquo;s coming next.</p>
{%- endif -%}
