---
id: T-013
title: Mechanic detection wizard
status: done
---

Suggest groups from card text, such as "makes tokens", so the user doesn't build them by hand. A wizard with the user in the loop: propose a filter, show what matches, let the user confirm the filter and each card before anything is tagged (user, 2026-11-09).

## Decision (user, 2026-11-10)

Not needed. The goal was a quick way to give a group of cards their tags, and [T-022](T-022-functions-as-tags.md) does that: Scryfall [oracle tags](../GLOSSARY.md#oracle-tag) fill in function tags such as token maker on every card and on each add.

## Done when (before the decision)

- A detected group can be reviewed card by card and saved as a group tag.
