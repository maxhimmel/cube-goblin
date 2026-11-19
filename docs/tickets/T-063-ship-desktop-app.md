---
id: T-063
title: Ship the desktop app to a friend
status: doing
---

The user wants to hand the desktop app ([T-056](T-056-desktop-app.md)) to a friend, with a goblin icon as its app icon and favicon and a fun name instead of "Cube Workbench" (user, 2026-11-16). Research: [desktop-delivery.md](../research/desktop-delivery.md).

## Decisions (user, 2026-11-16)

- **Name**: Cube Goblin.
- **Icon**: option I, a violet cube outline with goblin eyes, picked from twelve goblin drafts (user, 2026-11-16). App icon: "glow" (dark square, violet glow behind the cube, glowing eyes). Favicon: "max" (no background, a squat cube filling the square, bold lines, big glowing eyes), since a bare cube at 16px needs every pixel. It replaces favicon E ([T-050](T-050-visual-system.md)) in the workbench and share doc too.
- **Signing**: free first. No Apple Developer Program until unsigned delivery proves painful.
- **Friend's computer**: an M3 Mac (user, 2026-11-19), so the arm64 build covers it; no Windows or x64.

## Scope

- **Rename**: `productName` and `appId` in `apps/desktop/package.json`. The first launch moves the old `Cube Workbench` data folder over.
- **Icon**: option I glow as the app icon, from `build/icon.svg`; "max" as the favicon. The macOS 26 `.icon` format needs Xcode 26, which this Mac lacks ([research](../research/desktop-delivery.md#app-icon)).
- **Fix the seal first**: today's build fails `codesign --verify --deep --strict`, which risks a "damaged" dialog. Switch to ad-hoc signing (`identity: "-"`, `hardenedRuntime: false`) ([research](../research/desktop-delivery.md#macos-without-a-developer-id)).
- **Delivery**: the research note's [option 2](../research/desktop-delivery.md#options-for-one-friend): ad-hoc arm64 `dmg` + `zip` by link, with written Open Anyway steps for the friend. The link and steps come from [T-064](T-064-public-repo-and-releases.md) (user chose the full release flow over sending a file, 2026-11-19). Prove it by downloading on a second Mac.
- **Updates and hosting**: moved to [T-064](T-064-public-repo-and-releases.md). Developer ID ($99/yr) comes when updates get frequent.

## Built

- **Rename** (2026-11-16): `Cube Goblin`, `com.maxhimmel.cube-goblin`. Electron creates an empty data folder before main runs, so `adoptFormerUserData` (`apps/desktop/src/main/index.ts`) treats an empty folder as missing, then moves `~/Library/Application Support/Cube Workbench` in. Verified on the user's real data folder (24 entries moved).
- **Icon** (2026-11-16): `apps/desktop/build/icon.svg` is pre-shaped (rounded square, margin, shadow), since macOS 15 shows full-bleed art as a hard square ([research](../research/desktop-delivery.md#app-icon)); user picked option A, the same glow background, over a brighter halo (2026-11-16). electron-builder rasterizes it into `icon.icns` (checked at 1024 in the packaged app). The favicon in `apps/web/index.html` is a squat cube with no background that fills the square, so it reads at 16px in light and dark tabs.
- **Seal** (2026-11-16): `mac.identity: "-"`, `resetAdHocDarwinSignature` dropped (signing reseals after the fuses). `pnpm desktop:build` now makes an ad-hoc arm64 `dmg` + `zip` in `apps/desktop/release`. Checked: `codesign --verify --deep --strict` passes, fuses read as configured, `hdiutil verify` valid, packaged app launches. Not yet tested from a real download on a second Mac.
- **Ready to hand over** (2026-11-19): v0.1.1 is public. Send the friend the [README's Install section](https://github.com/maxhimmel/cube-goblin#install). Unconfirmed: the Gatekeeper flow from a real download on another Mac.

## Done when

- The friend opens Cube Goblin on their own computer with the goblin-eyes cube icon, following written steps, and knows how to get the next version.
