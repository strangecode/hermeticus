---
layout: home
title: Hermeticus Bookshop
description: An independent bookshop. Browse the catalogue, find upcoming events, and learn how to visit us.
permalink: /
---

<section class="hero container">
  <h1 class="hero__title">{{ site.title }}</h1>
  <p class="hero__lede">{{ site.description }}</p>
  <p class="hero__actions">
    <a class="button" href="{{ '/books/' | relative_url }}">Browse the books</a>
    <a class="button button--ghost" href="{{ '/contact/' | relative_url }}">Visit the shop</a>
  </p>
</section>

<section class="section container">
  <h2 class="section__title">What you&rsquo;ll find</h2>
  <div class="grid">
    <article class="card">
      <h3 class="card__title">A curated catalogue</h3>
      <p>Placeholder copy. Replace with a short description of the catalogue.</p>
    </article>
    <article class="card">
      <h3 class="card__title">Readings and events</h3>
      <p>Placeholder copy. Replace with a short description of upcoming events.</p>
    </article>
    <article class="card">
      <h3 class="card__title">A place to linger</h3>
      <p>Placeholder copy. Replace with a short description of the shop itself.</p>
    </article>
  </div>
</section>
