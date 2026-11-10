---
id: T-022
title: Functions as tags
status: done
---

Only six functions were tracked, and they lived apart from tags in their own Insights block (user, 2026-11-10).

## Decisions (user, 2026-11-10)

- Track a longer list of functions from Scryfall oracle tags.
- Functions are not separate data: each one is an ordinary tag of kind group in `cube/tags.json`, and cards carry it in their `tags`.
- The Functions chart goes away; the tags chart shows them.
- Twenty functions, lowercase like the designer's tags: removal, board wipe, burn, bounce, counterspell, discard, ramp, fixing, card draw, looting, tutor, recursion, reanimate, token maker, lifegain, sac outlet, mill, evasion, combat trick, protection.
- Scryfall fills them in once (`pnpm cube tag-functions`) and on each add; it never re-adds a tag the designer removed. An add only applies function tags that are still in `tags.json`.
- Ran once on 2026-11-10: 20 function tags added to `tags.json` and 219 tags to 121 cards. The Groups chart sorts by count and got a taller default.
- The share doc's snapshot now carries each card's tags and the vocabulary, so its tag charts show functions too.

## Done when

- Current cards carry their function tags, and a card added in `#/add` gets its function tags.
- No card or view mentions functions as a separate field.
