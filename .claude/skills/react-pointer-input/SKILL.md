---
name: react-pointer-input
description: Pointer gestures on React form controls. Use when adding drag-to-select, shift-click ranges, or custom pointer handling to checkboxes or other inputs.
---

# React pointer input

Lessons from the stats timeline picker (`apps/web/src/log/timeline.tsx`), where each bug shipped once.

- **Checkbox clicks fire `onChange` from the click event.** When `pointerdown` already applied the toggle, mark it in a ref and skip the `onChange` that follows; clear the mark after `pointerup` with `setTimeout`, because React runs the label's `onClick` before the input's `onChange`.
- **Keyboard toggles arrive as `onChange` only.** Let them through; a `preventDefault` on a keyboard click makes the browser restore the old checked state after React renders.
- **Gesture state lives in refs, not state.** A fast pointer enters the next control before React re-renders, so a handler reading state sees the old value. Hold the latest selection and the drag mode in refs, update them synchronously, and fill the range from the last anchor to the current control so skipped controls still count.
- **Reserve space for anything that appears on check** (swatches, badges) with `visibility: hidden`, so labels never shift under a drag.
- Prove it in Chromium with `page.mouse` drags of few `steps`, Shift- and Alt-clicks, and Space on a focused box ([workbench-testing](../workbench-testing/SKILL.md)).
