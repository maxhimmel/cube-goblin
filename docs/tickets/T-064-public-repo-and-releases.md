---
id: T-064
title: Public repo, releases, and README
status: todo
---

Put the repo on GitHub as a public repo under `maxhimmel` (`himmelmax@gmail.com`), release the desktop app from it, hand out one share link, and write a clean README (user, 2026-11-16). Unblocks delivery in [T-063](T-063-ship-desktop-app.md), whose open questions were hosting and updates.

## Scope

- **Research**: done, [github-releases.md](../research/github-releases.md).
- **Pre-publish audit**: run a secrets scanner over the full history. Rewrite the email with `git filter-repo --mailmap` in a `--no-local` clone under `/tmp`, never in this shared checkout ([research](../research/github-releases.md#rewriting-the-16-commits-email)) (a quick grep on 2026-11-16 found no token patterns and no blob over 1 MB; history is 9.7 MB). Confirm what goes public: `cube/` data, `docs/`, and the author emails (see Decisions).
- **Publish**: `gh` is logged in as `work-account`; add `maxhimmel` and create the repo with it. Push `main` with its full history, then add `origin`. Add the MIT `LICENSE` (choosealicense text, `2026 Max Himmel`).
- **Releases**: `pnpm release` bumps `apps/desktop/package.json` `version`, commits, tags `vX.Y.Z`, and pushes; it never runs electron-builder ([why](../research/github-releases.md#electron-builder-github-publisher-2618)). A `v*.*.*` tag workflow on `macos-26` runs the build with `--publish always` into a draft, checks the deep seal, then publishes it with `gh release edit --draft=false --latest`. Publish config: `owner`/`repo` set explicitly.
- **Share link**: `mac.artifactName: "Cube-Goblin-${arch}.${ext}"`, so `releases/latest/download/Cube-Goblin-arm64.dmg` always serves the newest build. An install page (README section) carries the Open Anyway steps ([desktop-delivery.md](../research/desktop-delivery.md#macos-without-a-developer-id)).
- **Update notice**: electron-updater against the public repo with `autoDownload: false`; a "new version" banner opens the share link. Ad-hoc builds can't auto-install ([research](../research/desktop-delivery.md#auto-update-electron-updater)). Takes over T-063's "Updates" bullet.
- **CI on `main`**: optional. Hooks already run `pnpm check` on every merge; CI adds a clean-machine run. Decide after the release workflow works.
- **README**: the Fan Content Policy note ([verbatim](../research/github-releases.md#readme-obligations)), also in the app's About; what Cube Goblin is (one paragraph, links to [VISION.md](../VISION.md)), a screenshot, the download link and install steps, dev quickstart (`pnpm install`, `pnpm dev`, `pnpm desktop`, `pnpm check`), and pointers to `docs/`. Points to sources rather than copying them.

## Decisions (user, 2026-11-16)

- **Repo**: `maxhimmel/cube-goblin`, public.
- **License**: MIT.
- **`work-email`**: rewrite the 16 commits' author email to `himmelmax@gmail.com` before the first push. A one-time exception to keeping the whole history, made while nothing is public. Other sessions' branches must be merged or rebased onto the rewritten `main` first.
- **Share doc on Pages**: not now.

## Defaults (agent, 2026-11-16; override any)

- Draft-then-publish, not `releaseType: "release"` (no 404 window). Immutable releases off until the workflow is stable.
- Stay on pnpm 10.8.1 with `pnpm/action-setup@v6`; pnpm 11 is a separate change.
- Keep `appId` `com.maxhimmel.cube-goblin`; changing it moves the data folder again.
- Check during the build whether electron-vite bundles electron-updater or it must be a runtime dependency.

## Open questions

- **Windows**: build NSIS in the same workflow, or Mac only until a friend needs it?

## Done when

- The public repo exists with full history and a README that a stranger can follow to install or develop.
- `pnpm release` produces a GitHub Release with dmg + zip, and the share link downloads the newest dmg.
- An older installed build shows the "new version" notice when a newer release exists.
