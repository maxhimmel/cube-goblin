---
id: T-023
title: Several tags per Board section
status: todo
---

A section links one tag, named after the section. The user wants a section name apart from its tags, and several tags at once (user, 2026-11-10).

## Decisions (user, 2026-11-10)

- A section keeps its own label and links any number of tags, picked from the vocabulary or created.
- "Apply" adds every linked tag to every card in the section, as one undoable edit. Cards dropped in later show "Tag N more".
- Taking a card out of a section never removes its tags.

## Done when

- A section can link two tags, apply both to its cards with one undo, and keep its own name.
