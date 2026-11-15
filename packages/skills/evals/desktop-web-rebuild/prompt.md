---
tags: [workbench-testing]
runs: 2
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

You are working in the mtg-maxs-cube pnpm monorepo (web app in apps/web, Electron app in apps/desktop, the cube data in cube/). Don't run anything; answer with the ordered commands and steps you would take, in under 15 lines.

You just changed a React component in apps/web/src. Check the change in the desktop app with a throwaway script.
