---
id: T-044
title: Papercuts
status: doing
---

Small UX annoyances (user, 2026-11-12), part of [T-043](T-043-polish-pass.md).

- **Nav text vanishes on hover.** Hovering the active view link turns its text the accent color on an accent background: `.topbar a:not(.brand):hover` outranks `.views a[data-status="active"]` (`apps/web/src/pane.css`).
- **Selection borders get cropped.** Outlines and borders on a selected item are clipped by a scrolling or clipping container. Seen too in the Lab at 1440px, where the Color × mana value block and the 7+ column run past the right edge.
- **Charts jitter on hover.** Each mark clears the peek on pointer leave and sets it on enter (`peekProps`, `apps/web/src/lab/lab-charts.tsx`), so crossing the gap between two marks resets the filters for a moment.

## Done when

- The active nav link stays readable on hover.
- One selection style that no container clips, used across views.
- Moving between chart marks goes straight from one peek to the next, with no reset in between; covered by e2e.
