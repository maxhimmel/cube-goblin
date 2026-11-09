---
id: T-009
title: Archive and delete cards
status: todo
---

Today no card file is ever deleted: a swap or a cut leaves the card in `cube/cards` with status `cut`, which works as the archive. The user (2026-11-09) wants an archive instead of full deletion, and an "are you sure?" step before deleting anything from it.

## Open questions

- Is `cut` the archive, or does the archive need its own status apart from "considered and cut"?
- What does delete remove: the card file only, or also its line in the source batch?
- Should a swap link the two cards (for example in notes) so the history reads both ways?

## Done when

- The user has answered the open questions.
- Deleting an archived card asks for confirmation, and e2e covers both cancel and confirm.
