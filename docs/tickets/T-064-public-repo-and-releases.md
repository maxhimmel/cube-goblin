---
id: T-064
title: Public repo, releases, and README
status: todo
---

Put the repo on GitHub as a public repo under `maxhimmel` (`himmelmax@gmail.com`), release the desktop app from it, hand out one share link, and write a clean README (user, 2026-11-16). Unblocks delivery in [T-063](T-063-ship-desktop-app.md), whose open questions were hosting and updates.

## Scope

- **Research first**, into a note in `docs/research/`: GitHub Releases and the `releases/latest/download/<asset>` link, electron-builder's `github` publish provider, Actions minutes and macOS arm64 runners for public repos, `GITHUB_TOKEN` release permissions, and what the README owes Scryfall ([scryfall-api.md](../research/scryfall-api.md)) and Wizards' Fan Content Policy.
- **Pre-publish audit**: run a secrets scanner over the full history (a quick grep on 2026-11-16 found no token patterns and no blob over 1 MB; history is 9.7 MB). Confirm what goes public: `cube/` data, `docs/`, and the author emails (see Decisions).
- **Publish**: `gh` is logged in as `work-account`; add `maxhimmel` and create the repo with it. Push `main` with its full history, then add `origin`. Add the MIT `LICENSE`.
- **Releases**: a `pnpm release` script (build the lever) bumps `apps/desktop/package.json` `version`, commits, tags `vX.Y.Z`, and pushes. A tag-triggered Actions workflow on a macOS arm64 runner builds the ad-hoc `dmg` + `zip` ([T-063](T-063-ship-desktop-app.md) config) and publishes them with `latest-mac.yml` to a GitHub Release.
- **Share link**: asset names without the version or spaces (`artifactName`), so one link always serves the latest build. An install page (README section) carries the Open Anyway steps ([desktop-delivery.md](../research/desktop-delivery.md#macos-without-a-developer-id)).
- **Update notice**: electron-updater against the public repo with `autoDownload: false`; a "new version" banner opens the share link. Ad-hoc builds can't auto-install ([research](../research/desktop-delivery.md#auto-update-electron-updater)). Takes over T-063's "Updates" bullet.
- **CI on `main`**: optional. Hooks already run `pnpm check` on every merge; CI adds a clean-machine run. Decide after the release workflow works.
- **README**: what Cube Goblin is (one paragraph, links to [VISION.md](../VISION.md)), a screenshot, the download link and install steps, dev quickstart (`pnpm install`, `pnpm dev`, `pnpm desktop`, `pnpm check`), and pointers to `docs/`. Points to sources rather than copying them.

## Decisions (user, 2026-11-16)

- **Repo**: `maxhimmel/cube-goblin`, public.
- **License**: MIT.
- **`work-email`**: rewrite the 16 commits' author email to `himmelmax@gmail.com` before the first push. A one-time exception to keeping the whole history, made while nothing is public. Other sessions' branches must be merged or rebased onto the rewritten `main` first.
- **Share doc on Pages**: not now.

## Open questions

- **Windows**: build NSIS in the same workflow, or Mac only until a friend needs it?

## Done when

- The public repo exists with full history and a README that a stranger can follow to install or develop.
- `pnpm release` produces a GitHub Release with dmg + zip, and the share link downloads the newest dmg.
- An older installed build shows the "new version" notice when a newer release exists.
