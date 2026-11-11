---
id: T-034
title: Persistence audit
status: todo
---

Having to set options again on every visit or reload is annoying (user, 2026-11-11). Every setting in every view saves when it changes and comes back on reload. [T-029](T-029-remember-view-choices.md) claims this; check each view's controls and fix any that reset.

## Done when

- Each view's controls are listed with how they persist, and an e2e test changes each, reloads, and finds it kept.
