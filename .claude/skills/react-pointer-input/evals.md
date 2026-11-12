# Evals: react-pointer-input

Give an agent the skill and the scenario; it sketches the handlers. Pass when every listed point holds.

1. "Add drag-to-select across a row of checkboxes, with Space still toggling one."
   - Applies the toggle on `pointerdown` and skips the click's `onChange` after it.
   - Lets keyboard toggles through `onChange`.
   - Keeps the drag mode and latest selection in refs and fills skipped controls from the anchor.
   - Keeps labels from shifting when a box is checked.

Last run 2026-11-12: pass (fresh agent given only the skill and the scenarios).
