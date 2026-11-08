Speak concisely; sacrifice grammar.

## Docs

- `docs/VISION.md`: what we're building and why. Read before planning features or UX.
- `docs/GLOSSARY.md`: canonical terms. Read before naming things in code, docs, or UI.
- `cube.config.json`: cube parameters (format, size). Read values from here; never hardcode them.
- `docs/research/`: findings with sources. Check before researching a topic; save new findings here.

## Commands

- `pnpm check`: every guard (format, markdown, cube data, lint, typecheck, test, build, cross-browser e2e, no shell scripts). Must pass before claiming done.
- `pnpm fix`: auto-fix what can be fixed, then re-run `pnpm check`.
- `pnpm cube --help`: card data CLI (Scryfall). Use it for every card lookup, batch add, and review import.
- `pnpm export`: build the single-file share doc into `exports/`. `pnpm dev`: run the web app locally.
- New card batches go in `cube/inbox/` untouched; corrections go in a separate `*-fixes.txt` batch.

## Rules

- **Rules become code.** When a rule can live as a lint rule, type, test, or check in `scripts/`, put it there instead of in prose.
- **Branch per change.** Work on a `<type>/<slug>` branch (e.g. `feat/card-images`). Merge into main with a merge commit (`git merge --no-ff`) once `pnpm check` passes.
- **Keep the whole history.** Every commit, mistake, and reversal stays visible. Undo with `git revert`; keep branch commits as they are rather than squashing, rebasing, or amending.
- **Commits: atomic, incremental, conventional.** One logical change per commit, and commit as each piece lands. Messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(cli): ...`, `fix(scryfall): ...`). `lefthook.yml` enforces branch name, message format, and `pnpm check` on commit.
- **TypeScript only.** Scripts are TypeScript run with zx, in `scripts/` or a workspace package.
- **Pointers over copies.** Every markdown, reference, doc, and skill states each fact once, in one source of truth, and links to it elsewhere. When a fact already lives in a doc, config, or API, point to it.
- **Research terms.** Before defining or relying on an MTG or domain term, check it against a primary source (mtg.wiki, MTG Comprehensive Rules, Scryfall, Cube Cobra). Record it in `docs/GLOSSARY.md` with its source link, and use the glossary's term everywhere.
- **Verify by running.** Prove a change works by running the app or the test and looking at the result.
- **Prototype first.** Build something real (a spike, a screenshot, a benchmark) early, so plans meet reality.
- **Start local.** Run work locally and watch it before scaling out to many agents.
- **Lessons become skills.** When a fix or correction repeats, capture it as a skill, with an eval to test it.
- **Build the lever.** Turn repeated manual work into a script or tool the agent can call.
- **Lean context.** This file holds only what nearly every task needs; everything else sits in `docs/` behind a pointer.

Source for the poteto rules: `docs/research/ai-agent-practices.md`. Tooling decisions: `docs/research/tooling.md`.
