---
title: Knowledge Base
layout: single
permalink: /kb/
classes: wide
toc: false
collection: kb
entries_layout: list
nav_exclude: true
order: 0

---

Welcome to the **Knowledge Base**. Read in this order:

{% assign pages = site.kb | sort: 'order' %}
<ol>
{% for p in pages %}
  {% if p.url != page.url %}
  <li>
    <a href="{{ p.url | relative_url }}">{{ p.title }}</a>
    {% if p.description %}<br><span style="color:#6b7280">{{ p.description }}</span>{% endif %}
  </li>
  {% endif %}
{% endfor %}
</ol>
