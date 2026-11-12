---
id: T-029
title: Remember view choices
status: done
---

Each view should keep the filter and sort choices the user made, both when they switch views and when they close and reopen the app (user, 2026-11-10). Today most choices live only in the URL search params, so going to another view and coming back resets them.

## Scope

- Remembered: Wall `by`, `with`, `without`; Cards `by`; Insights `scope`; Tags `tags`; Board `sort` and the pool's name filter and Both / Draft / Prospects switch.
- Not remembered, because they are about one moment: `card` (detail pane), `bucket` (drill-down panel), Versions `from` / `to`, and `add` / `replaces` (the add panel).
- Stored per browser in localStorage, like the Insights layout ([T-015](T-015-insights-dashboard-layout.md)). A link that carries its own params (for example a Tags overlap region opening the Wall with `?with=&without=`) wins over what was remembered.

## Done when

- Each remembered choice survives switching views and a reload, in the workbench and the share doc.
- Clearing a choice (back to its default) is remembered too.
- A unit test covers the store, and E2E covers one round trip per view.

## What shipped

`apps/web/src/view-choices.ts` holds the list of remembered search keys per view (`REMEMBERED`). The router saves them on every resolved navigation and, when a view is entered without any of its keys, redirects to the saved ones; changes made inside a view (`cause: "stay"`) are never overridden. Choices that are component state (the Wall's prospects tray, the Board pool's name filter, status switch, and "No section") use `useRemembered`. Both live in localStorage, per browser, in the workbench and the share doc.
