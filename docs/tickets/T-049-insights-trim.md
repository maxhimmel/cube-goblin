---
id: T-049
title: Insights trim
status: todo
---

Part of [T-043](T-043-polish-pass.md). Insights stays for bigger charts and deeper detail (user, 2026-11-12) but is about 5,000px tall at 1440px, with uneven block widths and gaps.

- Cut what the merged view ([T-046](T-046-wall-and-lab.md)) already shows, and the Status chart (it repeats the draft count).
- Drop zero rows (Card types lists Planeswalker 0 and Land 0) and the land tiles while the cube has no lands.
- The Groups chart shows the top tags and folds the rest.
- Blocks pack without gaps.

## Done when

- Every remaining block has a job the merged view doesn't do, the page packs tightly at 900px and 1440px, and e2e follows.
