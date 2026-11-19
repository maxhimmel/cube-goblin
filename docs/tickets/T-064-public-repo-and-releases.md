---
id: T-064
title: Public repo, releases, and README
status: done
---

Put the repo on GitHub as a public repo under `maxhimmel` (`himmelmax@gmail.com`), release the desktop app from it, hand out one share link, and write a clean README (user, 2026-11-16). Unblocks delivery in [T-063](T-063-ship-desktop-app.md), whose open questions were hosting and updates.

## Scope

- **Research**: done, [github-releases.md](../research/github-releases.md).
- **Pre-publish audit**: done (see Built).
- **Publish**: create the repo as `maxhimmel`. Push `main` with its full history, then add `origin`. Add the MIT `LICENSE` (choosealicense text, `2026 Max Himmel`).
- **Releases**: `pnpm release` bumps `apps/desktop/package.json` `version`, commits, tags `vX.Y.Z`, and pushes; it never runs electron-builder ([why](../research/github-releases.md#electron-builder-github-publisher-2618)). A `v*.*.*` tag workflow on `macos-26` runs the build with `--publish always` into a draft, checks the deep seal, then publishes it with `gh release edit --draft=false --latest`. Publish config: `owner`/`repo` set explicitly.
- **Share link**: `mac.artifactName: "Cube-Goblin-${arch}.${ext}"`, so `releases/latest/download/Cube-Goblin-arm64.dmg` always serves the newest build. An install page (README section) carries the Open Anyway steps ([desktop-delivery.md](../research/desktop-delivery.md#macos-without-a-developer-id)).
- **Update notice**: electron-updater against the public repo with `autoDownload: false`; a "new version" banner opens the share link. Ad-hoc builds can't auto-install ([research](../research/desktop-delivery.md#auto-update-electron-updater)). Takes over T-063's "Updates" bullet.
- **CI on `main`**: optional. Hooks already run `pnpm check` on every merge; CI adds a clean-machine run. Decide after the release workflow works.
- **README**: the Fan Content Policy note ([verbatim](../research/github-releases.md#readme-obligations)), also in the app's About; what Cube Goblin is (one paragraph, links to [VISION.md](../VISION.md)), a screenshot, the download link and install steps, dev quickstart (`pnpm install`, `pnpm dev`, `pnpm desktop`, `pnpm check`), and pointers to `docs/`. Points to sources rather than copying them.

## Decisions (user, 2026-11-16)

- **Repo**: `maxhimmel/cube-goblin`, public.
- **License**: MIT.
- **Nothing from the user's work identity in the public repo** (user, 2026-11-16): no work email, work GitHub account, or work domain, history included. A one-time exception to keeping the whole history, made before anything was public.
- **Share doc on Pages**: not now.

## Defaults (agent, 2026-11-16; override any)

- Draft-then-publish, not `releaseType: "release"` (no 404 window). Immutable releases off until the workflow is stable.
- Stay on pnpm 10.8.1 with `pnpm/action-setup@v6`; pnpm 11 is a separate change.
- Check during the build whether electron-vite bundles electron-updater or it must be a runtime dependency.

## Open questions

- **Windows**: Mac only; the friend is on an M3 ([T-063](T-063-ship-desktop-app.md)). Revisit when someone needs it.

## Built

- **History rewrite** (2026-11-16): `gitleaks` found no leaks in any ref. In a `git clone --no-local` copy, `git filter-repo` mapped the 16 work-email commits to `himmelmax@gmail.com` (`--mailmap`) and replaced the work email, account, and domain in every file and message (`--replace-text`, `--replace-message`); the app ID became `com.maxhimmel.cube-goblin` throughout. Verified zero matches across blobs, messages, idents, and paths; 810 commits, final tree unchanged apart from those strings. This checkout's 37 branches were then reset onto the rewritten ones.
- **App ID**: the data folder follows `productName`, not `appId`, so the new ID still opens `~/Library/Application Support/Cube Goblin` (checked on a packaged build).
- **This repo's GitHub account**: `.git/config` points the github.com credential at `gh auth git-credential` with username `maxhimmel` and sets `user.email`; a SessionStart hook in `.claude/settings.local.json` exports `GH_TOKEN=$(gh auth token -u maxhimmel)` for Claude sessions. Both stay local.

- **Release pipeline** (2026-11-19): `publish` (`github`, `maxhimmel`/`cube-goblin`) and `mac.artifactName: "Cube-Goblin-${arch}.${ext}"` in `apps/desktop/package.json`; `package` passes `--publish never`, `package:publish` `--publish always`. `pnpm release <patch|minor|major|X.Y.Z>` (`scripts/src/release.ts`) bumps on a `chore/release-*` branch, merges `--no-ff` (so the merge hook runs `pnpm check`), tags, pushes `main` and the tag. `.github/workflows/release.yml` builds on `macos-26`, checks the deep seal, then publishes the draft as latest with `.github/release-notes.md`.
- **Update notice** (2026-11-19): `apps/desktop/src/main/updates.ts` checks once per launch (packaged only, `autoDownload: false`); the workbench shows a sticky toast "Cube Goblin X is out." whose "Get it" opens the latest release page (not the bare dmg, so the install steps are one click away). electron-vite bundles electron-updater into `out/main` (`externalizeDeps: false`), so it stays a dev dependency.
- **About** (2026-11-19): app menu → About carries the Scryfall credit and the Fan Content notice (`apps/desktop/src/main/about.ts`).
- **README** (2026-11-19): what it is, a Forge screenshot (`docs/images/forge.png`), install and update steps, dev quickstart, credits.
- **First release** (2026-11-19): `pnpm release patch` cut v0.1.1 (0.1.0 was never released; the script only takes newer versions). The workflow passed on `macos-26`, seal check included. `releases/latest/download/Cube-Goblin-arm64.dmg` serves it; the downloaded dmg verifies and its app passes `codesign --verify --deep --strict`. A local 0.1.0 package showed "Cube Goblin 0.1.1 is out." Playwright `_electron` can't attach to a packaged build (the inspect fuses are off); `--remote-debugging-port` with `connectOverCDP` works.
- **Left open**: the update toast shares the single toast slot, so a later toast replaces it until the next launch. Windows stays out (see Open questions).

## Done when

- The public repo exists with full history and a README that a stranger can follow to install or develop.
- `pnpm release` produces a GitHub Release with dmg + zip, and the share link downloads the newest dmg.
- An older installed build shows the "new version" notice when a newer release exists.
