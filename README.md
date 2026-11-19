# Cube Goblin

A desktop workbench for designing a Magic: The Gathering [cube](docs/GLOSSARY.md): tune its cards, chart its balance, tag its themes, and share it with the people you draft with. What it's for and why: [VISION.md](docs/VISION.md).

![The Forge view: the draft by mana value, prospects, and charts](docs/images/forge.png)

## Install

Cube Goblin runs on Macs with Apple chips (M1, M2, M3, M4, or newer). To check yours: Apple menu → **About This Mac** → **Chip**.

1. Open **Terminal**: press **⌘ Command + Space**, type `Terminal`, and press **Return**. A window with text opens.
2. Copy this whole line (the copy button on its right corner works):

   ```sh
   osascript -e 'quit app "Cube Goblin"'; curl -fL# https://github.com/maxhimmel/cube-goblin/releases/latest/download/Cube-Goblin-arm64.zip -o /tmp/Cube-Goblin.zip && rm -rf "/Applications/Cube Goblin.app" && ditto -x -k /tmp/Cube-Goblin.zip /Applications && rm /tmp/Cube-Goblin.zip && open "/Applications/Cube Goblin.app"
   ```

3. Click in the Terminal window, paste with **⌘ Command + V**, and press **Return**.
4. Wait for the progress bar to fill (about a minute). Cube Goblin opens by itself, and it's now in your **Applications** folder. You can close Terminal.

What the line does: closes Cube Goblin if it's open, downloads the newest version from this page, puts it in Applications (replacing any older copy), and opens it. Your cubes are kept.

### Updates

When a new version is out, Cube Goblin shows a note at the bottom of its window. Run the same line again, the same way.

### Without Terminal

Download [Cube-Goblin-arm64.dmg](https://github.com/maxhimmel/cube-goblin/releases/latest/download/Cube-Goblin-arm64.dmg), open it, and drag **Cube Goblin** into **Applications**. The first time you open it, macOS says "“Cube Goblin.app” Not Opened", because Apple hasn't reviewed the app. That's expected: click **Done**, then open **System Settings → Privacy & Security**, scroll down, click **Open Anyway** next to the Cube Goblin message, and enter your password. Do this within an hour of the message. Apple's guide: [open a Mac app from an unknown developer](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac).

## Develop

Needs Node 22.13+ and pnpm (version in [`package.json`](package.json)).

```sh
pnpm install
pnpm dev        # web workbench at localhost:5173
pnpm desktop    # desktop app
pnpm check      # every guard; must pass before a merge
```

- [CLAUDE.md](CLAUDE.md): commands and working rules.
- [docs/ROADMAP.md](docs/ROADMAP.md): where things stand and what's next.
- [docs/](docs/): vision, views, glossary, tickets, and research notes.
- Releases: `pnpm release <patch|minor|major>` tags a version; [the release workflow](.github/workflows/release.yml) builds and publishes it.

## Credits

Card data and images from [Scryfall](https://scryfall.com). MIT [license](LICENSE).

Cube Goblin is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
