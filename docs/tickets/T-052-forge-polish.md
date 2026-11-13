---
id: T-052
title: Forge polish
status: doing
---

Feedback on [Forge](../GLOSSARY.md#forge) after [T-046](T-046-wall-and-lab.md) (user, 2026-11-12).

## Asked for

- Replace the Charts checkbox with a thin separator and a handle that collapses the charts, with a tooltip and a springy animation, for every panel side; hovering it also shows arrows to move the panel. The tooltip names the side an arrow would move it to, and the handle needs a backdrop so it reads over busy charts.
- Settings as tabs instead of one long list.
- Blocks and Layouts popups went off screen; clicking a Blocks label closed the popup.
- Image group heads didn't stay stuck while scrolling.
- Use the space at the top of Forge better: fewer rows of controls.
- The handle shouldn't pop open when the pointer only passes by.

## Built (2026-11-12)

- A seam runs between the chart panel and the cards (`apps/web/src/forge/seam.tsx`). Its handle hides or shows the charts; its chevron turns with the panel's side and flips with a spring. Only the small handle reacts to the pointer; after a 350ms dwell, or on keyboard focus, four arrows pop out on a frosted disc to move the panel; left and right hide below 1280px. The tooltip says "Hide charts", "Show charts", "Move charts to the left", or "Charts are on the right". The Charts switch and the panel-side setting are gone.
- Settings is a dialog with vertical tabs (Cube, Forge); the last tab is remembered.
- Blocks and Layouts share one popup (`apps/web/src/forge/menu.tsx`) that opens toward whichever side has room and closes only on a click outside, Escape, or focus leaving it.
- The bulk bar floats at the bottom of the draft pile, so it no longer covers the stuck group heads or moves tiles.

## Open

- Header layout: variants mocked on 2026-11-12, waiting on the user's pick.
