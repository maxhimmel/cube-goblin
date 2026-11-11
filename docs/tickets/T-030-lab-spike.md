---
id: T-030
title: Lab spike
status: doing
---

A rough prototype of the [Lab](../GLOSSARY.md#lab) ([T-031](T-031-lab-view.md)) to see what it looks like before building it properly (user, 2026-11-11). Built inside the app on real cube data at `#/lab?variant=a|b`; the code is rewritten in T-031, not shipped as is.

## Scope

- The card area (Wall layout, draft over prospects) plus three charts: mana curve bars, color by mana value heatmap, creature power by toughness dots.
- The faint draft baseline behind filtered charts, hover peek (dim cards that don't match), and a ghost delta while dragging a card ("2-drops 14 → 15").
- Filter pills are faked; the real query input is [T-028](T-028-filter-query-syntax.md).
- **Variant A**: the app's binder look, with a new layout.
- **Variant B**: modeled on the user's `marble-run/docs/board.html` (neutral surfaces, left rail with counts, segmented tabs, dense rows with hairlines, tinted `color-mix` pills, sticky detail panel, small motion), in this app's palette.

## Done when

- Both variants run on real data, and drag changes status.
- The user has seen screenshots of both and a recording of drag with the ghost delta and hover peek, and picked a direction. A winning B restyles the Lab only; an app-wide restyle would be its own ticket.
