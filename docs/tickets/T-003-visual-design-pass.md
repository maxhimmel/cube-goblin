---
id: T-003
title: Visual design pass
status: doing
---

Give the workbench and the share doc a deliberate look ("fun, simple, juicy, elegant" in [VISION.md](../VISION.md)) and the layout in [views.md](../design/views.md): the Wall, the prospects tray, the detail pane, and the card strip with a hover preview. Use the `frontend-design` skill.

## Decisions (user, 2026-11-09)

- Of three directions, the binder palette, plus lift and tilt on hover from the "kitchen table" direction.
- Layout: the Wall (deck-builder columns by mana value) over a binder of pockets or a two-zone table.
- The card page becomes a slide-in pane. Its big image stretched on desktop (a flex item stretched to the row height).
- Wall prototype approved (2026-11-09).
- Card type groups only; no "makes tokens" group yet ([T-013](T-013-mechanic-detection-wizard.md)).

## Done when

- The user approves a prototype of the Wall on real data.
- The Wall, the prospects tray, the detail pane, and the hover preview ship in the workbench, and the share doc uses the same look.
- Names, mana costs, and colors read at a glance on stacked cards.
- They look right at phone width and in dark mode.
- Deferred from T-001: tag picker keyboard navigation, tile checkbox size, indeterminate pile checkbox.
