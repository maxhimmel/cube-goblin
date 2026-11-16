---
id: T-063
title: Ship the desktop app to a friend
status: doing
---

The user wants to hand the desktop app ([T-056](T-056-desktop-app.md)) to a friend, with the favicon ([T-050](T-050-visual-system.md)) as its app icon and a fun name instead of "Cube Workbench" (user, 2026-11-16). Research: [desktop-delivery.md](../research/desktop-delivery.md).

## Decisions (user, 2026-11-16)

- **Name**: Cube Goblin.
- **Signing**: free first. No Apple Developer Program until unsigned delivery proves painful.
- **Friend's computer**: unknown. Ask the friend, or build for every likely target.

## Scope

- **Rename**: `productName` and `appId` in `apps/desktop/package.json`. The first launch moves the old `Cube Workbench` data folder over.
- **Icon**: favicon E as the app icon, from `build/icon.svg`. The macOS 26 `.icon` format needs Xcode 26, which this Mac lacks ([research](../research/desktop-delivery.md#app-icon)).
- **Fix the seal first**: today's build fails `codesign --verify --deep --strict`, which risks a "damaged" dialog. Switch to ad-hoc signing (`identity: "-"`, `hardenedRuntime: false`) ([research](../research/desktop-delivery.md#macos-without-a-developer-id)).
- **Delivery**: the research note's [option 2](../research/desktop-delivery.md#options-for-one-friend), unless the friend's machine says otherwise: ad-hoc arm64 `dmg` + `zip` by link, with written Open Anyway steps for the friend. Prove it by downloading on a second Mac. Add Windows NSIS or x64 only if the friend needs it.
- **Updates**: unsigned Macs can't install updates themselves; a check-only "new version" notice is the free option. Developer ID ($99/yr) comes when updates get frequent.
- **Open**: friend's OS and chip; where to host the download (no git remote yet).

## Built

- **Rename** (2026-11-16): `Cube Goblin`, `com.maxhimmel.cube-goblin`. Electron creates an empty data folder before main runs, so `adoptFormerUserData` (`apps/desktop/src/main/index.ts`) treats an empty folder as missing, then moves `~/Library/Application Support/Cube Workbench` in. Verified on the user's real data folder (24 entries moved).

## Done when

- The friend opens Cube Goblin on their own computer with the crossed-cards icon, following written steps, and knows how to get the next version.
