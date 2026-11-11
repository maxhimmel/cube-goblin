---
id: T-035
title: Lab-native charts
status: done
---

The Insights charts docked in the [Lab](../GLOSSARY.md#lab) only redrew for the filter and added a pill on click; they didn't peek on hover, draw the faint baseline, or show a ghost delta, so they couldn't show what one small change does across the cube ([T-031](T-031-lab-view.md) decisions). The user asked to simplify them for the Lab instead of forcing Insights charts in (2026-11-11).

## Built (2026-11-11)

- Summary (cards, nonland, lands, creatures), Color (each color, multicolored, colorless), Heavy pips, Card types, Archetypes, and Groups are Lab charts: `BarList` and `SummaryTiles` in `apps/web/src/lab/lab-charts.tsx`, counted from chart buckets by `bucketTallies` (`model.ts`), so every bar is a peek, a pill, and a query.
- They replace the Insights summary, color, heavy, types, archetypes, and groups blocks and the "Tags in draft" chips. Insights' curve, color by mana value, power and toughness, and status blocks leave the Lab (the Lab has its own). Creature balance and combat matchups stay Insights blocks.
- Saved dock settings (order, hidden, collapsed, pins, baselines) move to the new ids.
- Clicking buckets in the same chart builds one `or` pill (`pickKeys`, `or:` keys in `model.ts`); different charts still `and`. Hovering previews exactly what a click would do, and picked bars, cells, and chips are outlined (user, 2026-11-11).
- Archetypes and Groups switch between bars and chips (◫). Chips keep their text fixed and fill by the filtered share, and tag bars sort by the unfiltered count, so a peek never moves what's under the pointer (the user saw both jitter).
- E2E: hovering a prospect shows +1 on the summary and card types; hovering a color bar dims cards; clicking it applies "Has Red".

## Done when

- Every Lab chart except creature balance and combat matchups peeks on hover, draws the baseline under a filter, and shows ghost deltas, with e2e coverage.
