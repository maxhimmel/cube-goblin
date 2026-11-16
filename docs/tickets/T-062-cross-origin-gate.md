---
id: T-062
title: Cross-origin gate on every route
status: done
---

Only `/api/cubes/*` refuses requests from other sites today ([T-061](T-061-host-parity.md) gaps). Every other route, writes included, answers any local page, e.g. one served by another dev server on a different localhost port. The user wants one protection built into the server so no route needs its own check (user, 2026-11-16). Research: [cross-origin-protection.md](../research/cross-origin-protection.md).

## Scope

- **One gate, deny by default**: `crossOriginGate` in `packages/server` runs before any route. Its rules are the ones in the research note's [recommendation](../research/cross-origin-protection.md#recommendation-for-this-repo): Electron's `initiatorOrigin`, then `Sec-Fetch-Site` (`same-origin` or `none` only), then `Origin` (exact match, never `null`), then header-less requests allowed. Hostname limited to localhost, `127.0.0.1`, `[::1]`, or the app's own host. It covers all methods, GETs included. `fromWorkbench` in `cubes.ts` goes away.
- **Routes as a table, so they can't skip the gate**: turn the `if` chains in `workbench.ts` and `cubes.ts` into one declared route table (method, path pattern, handler). The server builds its handler from the table and wraps it in the gate. Hosts get only that wrapped handler: the unguarded `WorkbenchServer.handle` leaves the public type. A new route is a table row, so it is gated and tested without anyone remembering to.
- **Opt-out is explicit and central**: none is needed now. If one ever is, it is a field on the route's row (like Go's bypass patterns), visible in one place.
- **Real origins in the Vite adapter**: `workbench-plugin.ts` builds the request URL from the `Host` header instead of `http://workbench.local`, so "same origin" means what the browser sees.
- **Desktop**: check `initiatorOrigin` on the renderer's own `fetch` empirically (headers are settled: Electron sends no `Sec-Fetch-Site` or `Origin`). Record the result in the research note.
- **Tests**: one test walks every row of the route table and expects 403 for `Sec-Fetch-Site: cross-site`, `same-site`, an `Origin` from another localhost port, `Origin: null`, and a foreign `Host`; and a pass for `same-origin` and header-less requests. Both e2e suites keep passing, which proves the workbench's own calls still get through on each host.
- **Keep** `server.cors: false` and Vite's default `allowedHosts`.

## Built (2026-11-16)

- **TanStack first**: Start has global request middleware and a `createCsrfMiddleware`, but it covers server functions by default, rejects the header-less requests Electron sends, ignores `initiatorOrigin`, and would take over the dev server and split the build ([tanstack-server.md](../research/tanstack-server.md)). Kept the hand-built table; borrowed its "reject unknown `Sec-Fetch-Site` values" rule.
- **Table**: `packages/server/src/routes.ts` holds `RouteRow` (method, path or pattern, `example`, handler) and `dispatch`. `workbench.ts` and `CubeLibrary.routes` (`cubes.ts`) declare rows; write rows keep the stale-cube 409, the write queue, and logging. Every row must name an `example` path, which the gate test requests.
- **Gate**: `packages/server/src/gate.ts`, the research note's rules. `createCubeHostServer` returns `handle` = gate, then `dispatch`; it is the only handler a host gets (`createWorkbenchServer` and `WorkbenchServer.handle` are no longer exported; hosts see only `cube`, `watched`, and `isCubeFile`). Options name extra hosts: desktop passes `bundle`. `fromWorkbench` is gone, and with it the cube routes' JSON-only rule: the gate covers what it guarded, and no route keeps its own check. The origin is built from protocol and host, since Node reports `"null"` for `app://`.
- **Vite adapter**: request URLs come from the `Host` header, not `http://workbench.local`.
- **Tests**: `gate.test.ts` sends seven hostile shapes (cross-site, same-site, unknown value, another port's `Origin`, `Origin: null`, foreign `Host`, a foreign `initiatorOrigin`) to every row and expects 403, and checks the allowed shapes. Removing the gate fails 8 of its tests. It also checks that every row's path sits under `/api/` and that its `example` matches it, so a row can't sit outside the gate. Electron's `initiatorOrigin` measured as `app://bundle` ([research](../research/cross-origin-protection.md#electron)).
- **Gaps**: `vite --host` (LAN access) now gets 403 for a LAN address; add it to `hosts` if that's ever wanted.

## Done when

- A request from another localhost port gets 403 on every `/api` route in `pnpm dev`, the workbench works unchanged in both hosts, and adding a route can't bypass the gate (the route-walking test covers it with no edit).
