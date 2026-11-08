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
- **pnpm 10** blocks build scripts by default; `esbuild` is allowed in `pnpm-workspace.yaml`.
