import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { RecentCubes, WorkbenchOptions } from "@repo/server";
import {
  CHANGE_DEBOUNCE_MS,
  CUBE_CHANGED_EVENT,
  createCubeHostServer,
  recentCubesFor,
  startingCube,
} from "@repo/server";
import type { Plugin } from "vite";

const ORIGIN = "http://workbench.local";

function toRequest(req: IncomingMessage): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (name.startsWith(":")) {
      continue;
    }
    if (typeof value === "string") {
      headers.set(name, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    }
  }
  const method = req.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  return new Request(new URL(req.url ?? "/", ORIGIN), {
    method,
    headers,
    ...(hasBody ? { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: "half" } : {}),
  });
}

async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

export interface WorkbenchPluginOptions extends Omit<WorkbenchOptions, "cubeDir"> {
  cubeDir: string | undefined;
  fallbackCubeDir: string;
  userData: string;
  userDataFromEnv: boolean;
  home: string;
}

async function firstCube(options: WorkbenchPluginOptions, recent: RecentCubes): Promise<string> {
  if (options.cubeDir !== undefined && options.cubeDir !== "") {
    return options.cubeDir;
  }
  const found = await startingCube(recent, [options.fallbackCubeDir]);
  if (found === undefined) {
    throw new Error(`No cube opens; set CUBE_DIR or restore ${options.fallbackCubeDir}`);
  }
  return found;
}

export function workbench(options: WorkbenchPluginOptions): Plugin {
  return {
    name: "repo:workbench",
    apply: "serve",
    async configureServer(server) {
      const pinned = (options.cubeDir ?? "") !== "" && !options.userDataFromEnv;
      const recent = recentCubesFor(options.userData, pinned);
      const host = await createCubeHostServer({
        ...options,
        cubeDir: await firstCube(options, recent),
        recent,
        openByPath: true,
      });
      const workbenchServer = host.server;
      let pending: ReturnType<typeof setTimeout> | undefined;

      let watching = [...workbenchServer.watched()];
      server.watcher.add(watching);
      host.library.onSwitch(() => {
        void server.watcher.unwatch(watching);
        watching = [...workbenchServer.watched()];
        server.watcher.add(watching);
      });
      server.watcher.on("all", (_event, file) => {
        if (!workbenchServer.isCubeFile(file)) {
          return;
        }
        clearTimeout(pending);
        pending = setTimeout(() => {
          server.ws.send(CUBE_CHANGED_EVENT);
        }, CHANGE_DEBOUNCE_MS);
      });

      server.middlewares.use((req, res, next) => {
        if (!(req.url ?? "").startsWith("/api/")) {
          next();
          return;
        }
        host
          .handle(toRequest(req))
          .then(async (response) => {
            if (response === undefined) {
              next();
              return;
            }
            await sendResponse(res, response);
          })
          .catch((error: unknown) => {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: String(error) }));
          });
      });
    },
  };
}
