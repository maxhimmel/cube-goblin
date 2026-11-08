# Tooling decisions

Set up 2026-11-08. The config is the source of truth: `package.json` files, `turbo.json`, `packages/*-config`.

## Layout

- `apps/cli`: the `cube` CLI. Runs TS directly with `tsx`, no build step.
- `packages/scryfall`: typed Scryfall client. Responses are validated with zod, cached to `.cache/scryfall` for 24h, and throttled per endpoint.
- `packages/{typescript,eslint,prettier,markdownlint}-config`: shared configs.
- `scripts/`: zx orchestration (`check`, `fix`) and repo guards.
- Internal packages export `.ts` source directly ([Turborepo TS guide](https://turborepo.dev/docs/guides/tools/typescript)).

## Gotchas

- **TypeScript pinned to 6.0.x.** TS 7 is `latest`, but typescript-eslint 8.72 peers on `typescript >=4.8.4 <6.1.0`. Re-check before bumping.
- **zx doesn't run `.ts` natively on Node 22.** Run TS through `tsx`; zx is imported as a library ([zx TypeScript docs](https://google.github.io/zx/typescript)).
- **ESLint TS configs** (`eslint.config.ts`) need `jiti` installed.
- **Type-aware lint**: `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked` with `projectService` ([typed linting](https://typescript-eslint.io/getting-started/typed-linting)). The strict configs aren't semver-stable, so upgrades may add errors.
- **Custom rule `repo/no-comments`** enforces the no-comments convention. ESLint directives and shebangs are exempt.
- **markdownlint**: `extends` resolves the npm package `@repo/markdownlint-config`; verified working. MD013 (line length) is off.
- **pnpm 10** blocks build scripts by default; `esbuild` and `lefthook` are allowed in `pnpm-workspace.yaml`. Lefthook's postinstall installs the hooks ([lefthook npm docs](https://github.com/evilmartians/lefthook/blob/master/docs/installation/node.md)).

## Git hooks: lefthook

Chosen over simple-git-hooks and husky on 2026-11-08:

- **Husky**: its hooks are shell files, which breaks the TypeScript-only rule.
- **simple-git-hooks**: hooks have to be reinstalled after every config change, and it can't run commands in parallel.
- **Lefthook**: reads `lefthook.yml` on each run and re-syncs the hooks when the config changes ([no_auto_install](https://github.com/evilmartians/lefthook/blob/master/docs/configuration/no_auto_install.md)). Jobs can run in parallel, and `{1}` passes in the hook's arguments ([run](https://github.com/evilmartians/lefthook/blob/master/docs/configuration/run.md)).
- Comparisons: [pkgpulse](https://www.pkgpulse.com/guides/husky-vs-lefthook-vs-lint-staged-git-hooks-nodejs-2026), [DEV](https://dev.to/quave/lefthook-benefits-vs-husky-and-how-to-use-30je).

The branch guard (`scripts/src/branch.ts`) rejects commits on `main`/`master` and branch names that don't match `<type>/<slug>`. The types are the Conventional Commits set.
