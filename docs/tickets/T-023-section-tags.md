---
id: T-023
title: Several tags per Board section
status: done
---

A section links one tag, named after the section. The user wants a section name apart from its tags, and several tags at once (user, 2026-11-10).

## Decisions (user, 2026-11-10)

- A section keeps its own label and links any number of tags, picked from the vocabulary or created.
- "Apply" adds every linked tag to every card in the section, as one undoable edit. Cards dropped in later show "Tag N more".
- Taking a card out of a section never removes its tags.
- The section's header row stays one line, so pool and sections still line up: linked tags show as chips, "+ Tags" or "Edit" opens a popover with the same tag picker as the card pane (pick, or create as archetype or group), and "Apply to N" names how many cards are missing a tag. Unlinking a tag in the popover never touches cards. The old "Make tag" button is gone.
- `board.json` sections store `tags`; an old single `tag` is read as a list of one.

## Done when

- A section can link two tags, apply both to its cards with one undo, and keep its own name.
