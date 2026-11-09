---
id: T-016
title: Insights drill-down
status: done
---

Clicking a bar, heatmap cell, or table row in Insights ([T-004](T-004-stats-and-charts.md)) lists the cards in that bucket (user, 2026-11-09).

## Decisions (user, 2026-11-09)

- **Where**: a panel on Insights lists the bucket's cards as strips; a strip opens the card's detail pane. Clicking another bucket swaps the list. The bucket is in the URL.

## Done when

- Every chart's buckets list exactly the cards they count (the mana-symbols chart counts symbols, so its bucket lists every card with at least one).
- Works from the keyboard and in the share doc.

## What shipped

Click a bar or heatmap cell, press Enter on a focused one, or click a row in a table view: `?bucket=<kind>:<key>` opens a panel of that bucket's cards as Wall strips (hover for the image, click for the detail pane), and the chart dims everything else. Bucket matching is `inBucket` in `packages/cube/src/stats.ts`, tested against every chart's counts. The panel sits beside the grid, or above it on narrow screens.
