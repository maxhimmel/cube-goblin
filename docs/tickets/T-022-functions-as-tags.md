---
id: T-022
title: Functions as tags
status: todo
---

Only six functions were tracked, and they lived apart from tags in their own Insights block (user, 2026-11-10).

## Decisions (user, 2026-11-10)

- Track a longer list of functions from Scryfall oracle tags.
- Functions are not separate data: each one is an ordinary tag of kind group in `cube/tags.json`, and cards carry it in their `tags`.
- The Functions chart goes away; the tags chart shows them.

## Done when

- Current cards carry their function tags, and a card added in `#/add` gets its function tags.
- No card or view mentions functions as a separate field.
