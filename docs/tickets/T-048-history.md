---
id: T-048
title: History
status: done
---

Part of [T-043](T-043-polish-pass.md). Versions and the [change log](T-038-change-log.md) both answer "how did the cube change". Merge them into History: the log and its timeline, with saved [versions](../GLOSSARY.md#version) as named markers on it, and compare from any two points.

- The log page is about 16,000px tall at 1440px: entries collapse to one line by default, and the timeline stays in view while scrolling.
- The Versions page looks unstyled next to the other views; that goes away with the merge.

## Done when

- One History view replaces Versions and Log, the share doc still gets it read-only, e2e follows.

## Built (2026-11-13)

- `#/history` replaces Versions and Log; `#/log` and `#/versions` redirect there and keep their search. One History nav link (clock icon) in both modes.
- Entries are one line (time, subject, source, actions); the subject toggles the why and trailers, "Expand all" opens every entry, and picking a timeline dot opens its entry. The page is about 2,900px tall at 1440px with the real log, down from about 16,000px. The timeline was already sticky.
- Saved versions show as dashed rows among the entries and as dashed, labelled markers on the timeline. Save version sits in the toolbar.
- A point is now, a version, or just before or just after a log entry ([glossary](../GLOSSARY.md#history)). From and To on each entry and version set `?from=&to=` (To defaults to now); the comparison opens in a side pane under the card pane, and entries inside the range get an accent edge. The server rebuilds past points by undoing newer entries (`stateAtEntry`); all 58 real log points rebuild cleanly, and a point the log can't rebuild answers 409 with the conflicts.
- The share doc gets the same view read-only, without versions or compare.
- E2E: save and compare from a version and from an entry, range highlight, close; collapsed entries in the revert and share-doc tests; the ring-crop sweep covers `#/history` with the pane open.
