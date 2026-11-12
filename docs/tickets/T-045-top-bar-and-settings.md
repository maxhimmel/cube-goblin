---
id: T-045
title: Top bar and settings
status: todo
---

Part of [T-043](T-043-polish-pass.md). The top bar carries three bits of status text ("143 cards • live from cube/cards", "workbench • live", "all changes saved") plus "loading…"; it has bugged the user (2026-11-12).

- One save indicator in place of the status text.
- Add card becomes a top bar action (a "+" opening a quick-add panel) instead of a nav link to `#/add`.
- A global settings panel: one place for choices that today are scattered per view (the Lab's toolbar toggles, Board help, hide empty from [T-033](T-033-hide-empty.md)). Its contents settle as the merges land; [T-034](T-034-persistence-audit.md) inventories every stored setting.

## Done when

- The top bar shows brand, views, save state, "+", and settings, and nothing else; covered by e2e.
