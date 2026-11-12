---
id: T-044
title: Papercuts
status: done
---

Small UX annoyances (user, 2026-11-12), part of [T-043](T-043-polish-pass.md).

- **Nav text vanishes on hover.** Hovering the active view link turns its text the accent color on an accent background: `.topbar a:not(.brand):hover` outranks `.views a[data-status="active"]` (`apps/web/src/pane.css`).
- **Selection borders get cropped.** Outlines and borders on a selected item are clipped by a scrolling or clipping container.
- **Charts jitter on hover.** Each mark clears the peek on pointer leave and sets it on enter (`peekProps`, `apps/web/src/lab/lab-charts.tsx`), so crossing the gap between two marks resets the filters for a moment.

## Done when

- The active nav link stays readable on hover.
- One selection style that no container clips, used across views.
- Moving between chart marks goes straight from one peek to the next, with no reset in between; covered by e2e.

## Built (2026-11-12)

- The hover color skips the active link.
- Selection rings on strips, tiles, Lab cells, and combat dots are drawn inside the element (`outline-offset: -2px` or an inset shadow), so a scroller can't crop them; keyboard focus on strips does the same.
- `usePeek` (`apps/web/src/lab/use-peek.ts`) sets a peek at once and clears it only after `PEEK_RELEASE_MS` (150ms); entering another mark cancels the clear. Picking clears at once.
- E2E: the active link's color on hover, the ring's offset, and a pointer sweep across two Color bars with no reset.
- The Lab's top blocks and columns running past the right edge at 1440px belong to [T-046](T-046-wall-and-lab.md).
