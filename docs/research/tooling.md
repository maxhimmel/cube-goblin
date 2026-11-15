# Tooling decisions

Set up 2026-11-08. The config is the source of truth: `package.json` files, `turbo.json`, `packages/*-config`.

## Layout

- `apps/cli`: the `cube` CLI. Runs TS directly with `tsx`, no build step.
- `apps/web`: the workbench (`pnpm dev`, and `build:desktop` for the desktop app) and the share doc (`build`).
- `apps/desktop`: the Electron app ([desktop-shell.md](desktop-shell.md)).
- `packages/server`: the workbench's `/api` routes as one `Request → Response` handler, mounted by the Vite plugin and by the desktop app.
- `packages/scryfall`: typed Scryfall client. Responses are validated with zod, cached to `.cache/scryfall` for 24h, and throttled per endpoint.
- `packages/{typescript,eslint,prettier,markdownlint}-config`: shared configs.
- `scripts/`: zx orchestration (`check`, `fix`) and repo guards.
- Internal packages export `.ts` source directly ([Turborepo TS guide](https://turborepo.dev/docs/guides/tools/typescript)).

## Gotchas

- **TypeScript pinned to 6.0.x.** TS 7 is `latest`, but typescript-eslint 8.72 peers on `typescript >=4.8.4 <6.1.0`. Re-check before bumping.
- **zx doesn't run `.ts` natively on Node 22.** Run TS through `tsx`; zx is imported as a library ([zx TypeScript docs](https://google.github.io/zx/typescript)).
- **ESLint TS configs** (`eslint.config.ts`) need `jiti` installed.
- **Type-aware lint**: `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked` with `projectService` ([typed linting](https://typescript-eslint.io/getting-started/typed-linting)). The strict configs aren't semver-stable, so upgrades may add errors.
- **React hooks lint**: `eslint-plugin-react-hooks` `configs.flat.recommended` (rules of hooks plus React Compiler rules; [README](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks), [rules](https://react.dev/reference/eslint-plugin-react-hooks)). Some rules default to `warn`, so every `lint` script runs `eslint . --max-warnings 0`.
- **Custom rule `repo/no-comments`** enforces the no-comments convention. ESLint directives and shebangs are exempt.
- **markdownlint**: `extends` resolves the npm package `@repo/markdownlint-config`; verified working. MD013 (line length) is off.
- **pnpm 10** blocks build scripts by default; `esbuild` and `lefthook` are allowed in `pnpm-workspace.yaml`. Lefthook's postinstall installs the hooks ([lefthook npm docs](https://github.com/evilmartians/lefthook/blob/master/docs/installation/node.md)).

## Git hooks: lefthook

Chosen over simple-git-hooks and husky on 2026-11-08:

- **Husky**: its hooks are shell files, which breaks the TypeScript-only rule.
- **simple-git-hooks**: hooks have to be reinstalled after every config change, and it can't run commands in parallel.
- **Lefthook**: reads `lefthook.yml` on each run and re-syncs the hooks when the config changes ([no_auto_install](https://github.com/evilmartians/lefthook/blob/master/docs/configuration/no_auto_install.md)). Jobs can run in parallel, and `{1}` passes in the hook's arguments ([run](https://github.com/evilmartians/lefthook/blob/master/docs/configuration/run.md)).
- **Staged files** (2026-11-12): `{staged_files}` passes the staged files; with `glob`, a job whose files all filter out is skipped, and `root` runs the job in a package and filters paths to it ([run](https://lefthook.dev/configuration/run/), [glob](https://lefthook.dev/configuration/glob/), [root](https://lefthook.dev/configuration/root/)). `glob_matcher: doublestar` gives standard `**` (the default `**` needs one or more directories).
- **Unstaged changes** (tested 2026-11-12 on 2.2.2, not documented): during pre-commit, lefthook hides the unstaged hunks of files that are partly staged, but a file with no staged changes stays as it is on disk. Whole-project jobs (typecheck, unit tests) therefore still see unstaged edits.
- **Hook split** (2026-11-12, from [session timing](session-timing.md)): pre-commit runs per-file checks on staged files plus cached typecheck and unit tests (about 1–5 s); `pre-merge-commit` runs the full `pnpm check` with e2e. Git runs `pre-merge-commit` before it records an automatic merge ([githooks](https://git-scm.com/docs/githooks#_pre_merge_commit)).
- Comparisons: [pkgpulse](https://www.pkgpulse.com/guides/husky-vs-lefthook-vs-lint-staged-git-hooks-nodejs-2026), [DEV](https://dev.to/quave/lefthook-benefits-vs-husky-and-how-to-use-30je).

The branch guard (`scripts/src/branch.ts`) rejects commits on `main`/`master` and branch names that don't match `<type>/<slug>`. The types are the Conventional Commits set.

## Charts (2026-11-09)

- **`@tanstack/charts`** (with `@tanstack/charts/react`): TanStack's chart grammar, first published 2026-07. SVG by default, keyboard focus, built-in tooltip, React 18/19 peers ([npm](https://www.npmjs.com/package/@tanstack/charts), [repo](https://github.com/TanStack/charts)). Young and fast-moving (about 40 releases in 3 months). From 1.0 its [compatibility contract](https://tanstack.com/charts/latest/docs/compatibility) holds breaking changes for majors; pinned exactly at 1.5.0 anyway.
- **Bundle**: import exact subpaths (`/scales/band`, `/scales/linear`, `/tooltip`); compact scales need no D3 at runtime. A bar chart with a tooltip added 116 KB to the share doc (3.44 → 3.56 MB), and it renders from `file://` (spike, 2026-11-09).
- **Theming**: marks take CSS variables in `fill`; text and grid follow the container's `color`.
- **Rejected**: `react-charts` (last release 2023, React 16 peer) and `@tanstack/react-table` (a counts table is a few lines without it).

## Dashboard grid (2026-11-09)

- **`react-grid-layout`** 2.3.0 (pinned): drag, resize, and vertical compaction (blocks move up to fill gaps), with breakpoints and per-breakpoint layouts. v2 is a TypeScript rewrite with `useContainerWidth`; its `css/styles.css` already includes the resize-handle styles ([README](https://github.com/react-grid-layout/react-grid-layout#readme)). TanStack has no layout library; `@dnd-kit/react` (0.5.x) sorts but does not resize.
- **Gotcha**: `useContainerWidth` attaches its `ResizeObserver` once, on mount. If its container div isn't rendered on that first pass (say, behind a loading state), the width stays at the 1280 px default. Put the hook in a component that mounts with its container.
- **Gotcha**: children are wrapped and given `style`/`className`/mouse handlers; wrap custom components in a plain `div` rather than forwarding refs.
- **Not keyboard-operable**: dragging and resizing need a pointer; collapse and "Reset layout" are buttons.

## Claude Code plugin (2026-11-12)

- The repo is its own plugin marketplace: `.claude-plugin/marketplace.json` at the root lists the `cube` plugin at `./packages/skills`, whose `.claude-plugin/plugin.json` needs only `name`; skills sit in `skills/<name>/SKILL.md` and load as `cube:<name>` ([create a plugin](https://code.claude.com/docs/en/plugins/create.md), [marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference.md)).
- `.claude/settings.json` declares the marketplace (`extraKnownMarketplaces`, a `directory` source) and enables `cube@maxs-cube` ([settings](https://code.claude.com/docs/en/settings-reference)). Tested here: the project declaration alone did not load the skills in a fresh `claude -p` session; after `claude plugin marketplace add ./` the skills loaded, with the committed path left as `./`. `pnpm skills:setup` does that add at `--scope local`, which writes the machine's absolute path to the gitignored `.claude/settings.local.json`.
- A plugin in a local-directory marketplace loads in place: edits apply at the next session or `/reload-plugins`, with no version bump ([plugin loading](https://code.claude.com/docs/en/plugins/loading.md)).
- Evals: `claude plugin eval` runs `evals/<case>/prompt.md` with graders in `graders/*.md` (`llm` rubrics, `tool_used: Skill` to see the skill fire) against the plugin and a no-plugin baseline, and writes `evals/results/` (gitignored) ([plugin evals](https://code.claude.com/docs/en/plugin-evals.md)). First run 2026-11-12: 6 cases, all pass with the plugin, mean Δ +0.83 over baseline, $0.78.
