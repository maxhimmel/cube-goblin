import type { CubeFolder } from "@repo/cube";
import { createCubeFolder, findCubeFolder, openCubeFolder } from "@repo/cube";
import type { OfflineStatus, Workbench } from "@repo/cube/browser";
import type { CubeList, CubeRef } from "./events.ts";
import { CUBES_ROUTE } from "./events.ts";
import { crossOriginGate } from "./gate.ts";
import type { RecentCubes } from "./recent-cubes.ts";
import type { RouteContext, RouteRow } from "./routes.ts";
import { dispatch, json } from "./routes.ts";
import type { WorkbenchOptions, WorkbenchServer } from "./workbench.ts";
import { createWorkbenchServer } from "./workbench.ts";

export interface CubeLibraryOptions {
  server: WorkbenchServer;
  recent: RecentCubes;
  home: string;
  openByPath: boolean;
}

export class CubeError extends Error {}

function refOf(folder: CubeFolder): CubeRef {
  return { dir: folder.dir, id: folder.config.id, name: folder.config.name };
}

function stringField(body: unknown, field: string): string {
  const value =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)[field]
      : undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new CubeError(`Missing "${field}"`);
  }
  return value;
}

async function bodyOf(request: Request): Promise<unknown> {
  return request.json().catch(() => undefined);
}

function answering(work: (context: RouteContext) => Promise<unknown>) {
  return async (context: RouteContext): Promise<Response> => {
    try {
      return json(200, await work(context));
    } catch (error) {
      const status = error instanceof CubeError ? 400 : 500;
      return json(status, { error: error instanceof Error ? error.message : String(error) });
    }
  };
}

export class CubeLibrary {
  readonly #server: WorkbenchServer;
  readonly #recent: RecentCubes;
  readonly #home: string;
  readonly #openByPath: boolean;
  readonly #listeners = new Set<(cube: CubeRef) => void>();

  constructor(options: CubeLibraryOptions) {
    this.#server = options.server;
    this.#recent = options.recent;
    this.#home = options.home;
    this.#openByPath = options.openByPath;
  }

  get home(): string {
    return this.#home;
  }

  onSwitch(listener: (cube: CubeRef) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  async remember(): Promise<void> {
    await this.#recent.opened(refOf(this.#server.cube()));
  }

  async list(): Promise<CubeList> {
    return { current: refOf(this.#server.cube()), recent: (await this.#recent.load()).cubes };
  }

  async create(name: string): Promise<CubeRef> {
    const { format, size } = this.#server.cube().config;
    const folder = await createCubeFolder(this.#home, name, { format, size });
    return this.#switch(folder.dir);
  }

  async switchTo(dir: string): Promise<CubeRef> {
    if (!(await this.#known(dir))) {
      throw new CubeError("Only a cube from the recent list can be opened this way");
    }
    return this.#switch(dir);
  }

  async open(dir: string): Promise<CubeRef> {
    const found = await findCubeFolder(dir);
    if (found === undefined) {
      throw new CubeError(
        "That folder holds no cube: a cube folder has a cube.config.json file or a cards/ folder",
      );
    }
    return this.#switch(found);
  }

  async remove(dir: string): Promise<CubeList> {
    if (dir === this.#server.cube().dir) {
      throw new CubeError("The open cube can't be removed from the list");
    }
    await this.#recent.remove(dir);
    return this.list();
  }

  async offlineStatus(dir: string): Promise<OfflineStatus> {
    if (dir !== this.#server.cube().dir && !(await this.#known(dir))) {
      throw new CubeError("Only a cube from the recent list has an offline status");
    }
    return this.#server.offlineStatus(dir);
  }

  async cards(dir: string): Promise<Workbench> {
    if (dir !== this.#server.cube().dir && !(await this.#known(dir))) {
      throw new CubeError("Only a cube from the recent list can be compared");
    }
    return this.#server.peek(dir);
  }

  get routes(): RouteRow[] {
    const post = (path: string, work: (body: unknown) => Promise<unknown>): RouteRow => ({
      method: "POST",
      path,
      example: path,
      handle: answering(async ({ request }) => work(await bodyOf(request))),
    });
    return [
      {
        method: "GET",
        path: CUBES_ROUTE,
        example: CUBES_ROUTE,
        handle: answering(() => this.list()),
      },
      {
        method: "GET",
        path: `${CUBES_ROUTE}/offline`,
        example: `${CUBES_ROUTE}/offline?dir=x`,
        handle: answering(({ url }) => this.offlineStatus(url.searchParams.get("dir") ?? "")),
      },
      {
        method: "GET",
        path: `${CUBES_ROUTE}/cards`,
        example: `${CUBES_ROUTE}/cards?dir=x`,
        handle: answering(({ url }) => this.cards(url.searchParams.get("dir") ?? "")),
      },
      post(CUBES_ROUTE, (body) => this.create(stringField(body, "name").trim())),
      post(`${CUBES_ROUTE}/switch`, (body) => this.switchTo(stringField(body, "dir"))),
      post(`${CUBES_ROUTE}/remove`, (body) => this.remove(stringField(body, "dir"))),
      ...(this.#openByPath
        ? [post(`${CUBES_ROUTE}/open`, (body) => this.open(stringField(body, "dir")))]
        : []),
    ];
  }

  async #known(dir: string): Promise<boolean> {
    return (await this.#recent.load()).cubes.some((cube) => cube.dir === dir);
  }

  async #switch(dir: string): Promise<CubeRef> {
    const ref = refOf(await this.#server.open(dir));
    await this.#recent.opened(ref);
    for (const listener of this.#listeners) {
      listener(ref);
    }
    return ref;
  }
}

async function opens(dir: string): Promise<boolean> {
  try {
    await openCubeFolder(dir);
    return true;
  } catch (error) {
    console.warn(`Skipping ${dir}: ${String(error)}`);
    return false;
  }
}

export async function startingCube(
  recent: RecentCubes,
  fallbacks: readonly string[],
): Promise<string | undefined> {
  const { cubes } = await recent.load();
  const legacy = await recent.legacyFolder();
  const candidates = [
    ...cubes.map((cube) => cube.dir),
    ...(legacy === undefined ? [] : [legacy]),
    ...fallbacks,
  ];
  for (const dir of candidates) {
    if (await opens(dir)) {
      return dir;
    }
  }
  return undefined;
}

export interface CubeHostServerOptions extends WorkbenchOptions {
  home: string;
  recent: RecentCubes;
  openByPath: boolean;
  hosts: readonly string[];
}

export interface CubeHostServer {
  server: Pick<WorkbenchServer, "cube" | "watched" | "isCubeFile">;
  library: CubeLibrary;
  routes: readonly RouteRow[];
  handle: (request: Request) => Promise<Response | undefined>;
}

export async function createCubeHostServer(
  options: CubeHostServerOptions,
): Promise<CubeHostServer> {
  const server = await createWorkbenchServer(options);
  const library = new CubeLibrary({
    server,
    recent: options.recent,
    home: options.home,
    openByPath: options.openByPath,
  });
  await library.remember();
  const routes = [...library.routes, ...server.routes];
  return {
    server,
    library,
    routes,
    handle: async (request) =>
      crossOriginGate(request, { hosts: options.hosts }) ?? dispatch(routes, request),
  };
}
