---
id: T-043
title: Polish pass
status: done
---

A major polish across the whole app: cut, combine, and refine every view, chart, popup, and panel against the job it serves ([views.md](../design/views.md)). Agreed with the user on 2026-11-12, after a screenshot audit of every view at 1440px and 900px.

## Decisions (user, 2026-11-12)

- Merge the Wall and the [Lab](T-031-lab-view.md) into one view with a new name: [T-046](T-046-wall-and-lab.md).
- Keep Insights for bigger charts and deeper detail; stop repeating what the merged view shows: [T-049](T-049-insights-trim.md).
- Merge Board and Tags into one tag workspace: [T-047](T-047-tag-workspace.md).
- One tag concept instead of tag, group, and archetype: [T-047](T-047-tag-workspace.md).
- Merge Versions into the Log as History: [T-048](T-048-history.md).
- Add card becomes a top bar action; the top bar's status text consolidates; a global settings panel: [T-045](T-045-top-bar-and-settings.md).
- The Cards image grid "looks horrendous": rework or fold into the merged view, decided in [T-046](T-046-wall-and-lab.md).
- Favicon options to look at, and one look across views: [T-050](T-050-visual-system.md).

## Order

1. [T-044](T-044-papercuts.md) papercuts.
2. [T-045](T-045-top-bar-and-settings.md), then the merges ([T-046](T-046-wall-and-lab.md), [T-047](T-047-tag-workspace.md), [T-048](T-048-history.md)), then [T-049](T-049-insights-trim.md).
3. [T-050](T-050-visual-system.md) runs alongside: each merge adopts the shared look as it lands.

## Done when

- Every ticket above is done and [views.md](../design/views.md) lists the new set of views.
