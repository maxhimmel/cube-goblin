---
id: T-035
title: Insights blocks in the Lab follow peek, baseline, and ghosts
status: todo
---

The Lab's own charts (curve, color by mana value, power by toughness) dim cards while a bar is hovered, draw the unfiltered scope faint behind a filter, and show a ghost delta while a card is dragged or hovered ([T-031](T-031-lab-view.md) decisions). The Insights charts docked in the Lab (`chartBlock`, `@tanstack/charts`) only redraw for the filter and add a pill on click.

## Done when

- Hovering a bar or cell of a docked Insights chart peeks at that bucket, filtered charts draw the faint baseline, and dragging a card shows its ghost delta, with e2e coverage of the peek.
