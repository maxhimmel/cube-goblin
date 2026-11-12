---
id: T-034
title: Persistence audit
status: done
---

Having to set options again on every visit or reload is annoying (user, 2026-11-11). Every setting in every view saves when it changes and comes back on reload. [T-029](T-029-remember-view-choices.md) claims this; check each view's controls and fix any that reset.

## Inventory (2026-11-12)

"URL" choices survive a reload in the hash and come back on switching views through `REMEMBERED` (`apps/web/src/view-choices.ts`). "Stored" ones use `useRemembered` (localStorage, per browser). Both work in the workbench and the share doc.

| View      | Kept                                                                                                                                                                  | How                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Wall      | columns and rows, tag filter                                                                                                                                          | URL                                                                       |
| Wall      | prospects tray open                                                                                                                                                   | stored                                                                    |
| Cards     | organize by                                                                                                                                                           | URL                                                                       |
| Board     | sort chain                                                                                                                                                            | URL                                                                       |
| Board     | pool name filter, status switch, No section                                                                                                                           | stored                                                                    |
| Tags      | picked tags                                                                                                                                                           | URL                                                                       |
| Insights  | scope (not the Cards selection)                                                                                                                                       | URL                                                                       |
| Insights  | block order, size, collapsed, hidden                                                                                                                                  | stored (`insights/layout.ts`)                                             |
| Insights  | each block's Table toggle                                                                                                                                             | stored, fixed here                                                        |
| Insights  | filter block view                                                                                                                                                     | `cube/filters.json` in the workbench; stored in the share doc, fixed here |
| Insights  | filter block Table toggle                                                                                                                                             | stored per filter, fixed here                                             |
| Lab       | filter pills, chips, baseline, hide, cut, axis, card view, strip tags, dock place and open, chart order, hidden, collapsed, pins, baselines, pending moves and gutter | stored                                                                    |
| Lab       | tile Table toggle                                                                                                                                                     | stored, fixed here (no default tile has one today)                        |
| Lab       | named layouts                                                                                                                                                         | `cube/layouts.json`                                                       |
| Log       | timeline stats and mode                                                                                                                                               | stored                                                                    |
| Log       | filter text, timeline stat group                                                                                                                                      | stored, fixed here                                                        |
| Share doc | reviewer name, votes, comments                                                                                                                                        | `review-store.ts`                                                         |

Kept on reload by the URL only, on purpose (one moment, per [T-029](T-029-remember-view-choices.md)): open card, Insights drill-down, Versions compare pair, swap target. Not kept: text being typed into editors and pickers, selections, hover and drag state, the Add page's status and copy-tags for one add.

## Done when

- Each view's controls are listed with how they persist, and an e2e test changes each, reloads, and finds it kept.
