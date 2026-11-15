import type { FSWatcher } from "node:fs";
import { watch } from "node:fs";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type { IpcMainInvokeEvent } from "electron";
import { BrowserWindow, app, dialog, ipcMain, net, protocol, session, shell } from "electron";
import type { CubeFolder } from "@repo/cube";
import { createCubeFolder, findCubeFolder, openCubeFolder } from "@repo/cube";
import {
  CHANGE_DEBOUNCE_MS,
  CUBES_CHANNEL,
  CUBE_CHANGED_EVENT,
  createWorkbenchServer,
} from "@repo/server";
import type { CubeList, CubeRef, WorkbenchServer } from "@repo/server";
import { RecentCubes } from "./recent-cubes.ts";

const SCHEME = "app";
const HOST = "bundle";
const ORIGIN = `${SCHEME}://${HOST}`;
const EXTERNAL_HOSTS = new Set(["scryfall.com", "tagger.scryfall.com"]);
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

const userDataOverride = process.env["CUBE_USER_DATA"];
if (userDataOverride !== undefined && userDataOverride !== "") {
  app.setPath("userData", userDataOverride);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true },
  },
]);

function rendererDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "renderer")
    : resolve(app.getAppPath(), "..", "web", "dist-desktop");
}

function cubesHome(): string {
  const fromEnv = process.env["CUBES_HOME"];
  return fromEnv !== undefined && fromEnv !== ""
    ? fromEnv
    : join(app.getPath("documents"), "Cubes");
}

function refOf(folder: CubeFolder): CubeRef {
  return { dir: folder.dir, id: folder.config.id, name: folder.config.name };
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

async function firstCube(recent: RecentCubes): Promise<string | undefined> {
  const fromEnv = process.env["CUBE_DIR"];
  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv;
  }
  const { cubes } = await recent.load();
  const legacy = await recent.legacyFolder();
  const candidates = [
    ...cubes.map((cube) => cube.dir),
    ...(legacy === undefined ? [] : [legacy]),
    ...(app.isPackaged ? [] : [resolve(app.getAppPath(), "..", "..", "cube")]),
  ];
  for (const dir of candidates) {
    if (await opens(dir)) {
      return dir;
    }
  }
  const { response } = await dialog.showMessageBox({
    message: "Start a cube",
    detail: `A new cube is a folder in ${cubesHome()}. You can also open a cube folder you already have.`,
    buttons: ["New cube", "Open folder…", "Quit"],
    defaultId: 0,
    cancelId: 2,
  });
  if (response === 0) {
    return (await createCubeFolder(cubesHome(), "My Cube")).dir;
  }
  return response === 1 ? pickFolder() : undefined;
}

async function pickFolder(): Promise<string | undefined> {
  const picked = await dialog.showOpenDialog({
    title: "Open a cube folder",
    defaultPath: cubesHome(),
    properties: ["openDirectory", "createDirectory"],
  });
  const dir = picked.filePaths[0];
  if (picked.canceled || dir === undefined) {
    return undefined;
  }
  const found = await findCubeFolder(dir);
  if (found === undefined) {
    await dialog.showMessageBox({
      type: "warning",
      message: "That folder holds no cube",
      detail: "A cube folder has a cube.config.json file or a cards/ folder.",
    });
  }
  return found;
}

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

async function serveFile(root: string, pathname: string): Promise<Response> {
  let relative: string;
  try {
    relative = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const file = resolve(root, `.${relative}`);
  if (!file.startsWith(root + sep)) {
    return new Response("Bad request", { status: 400 });
  }
  let response: Response;
  try {
    response = await net.fetch(pathToFileURL(file).toString());
  } catch {
    return notFound();
  }
  if (!file.endsWith(".html")) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", CSP);
  return new Response(response.body, { status: response.status, headers });
}

function serve(server: WorkbenchServer): void {
  const root = rendererDir();
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== HOST) {
      return notFound();
    }
    return (await server.handle(request)) ?? serveFile(root, url.pathname);
  });
}

function watchCube(server: WorkbenchServer): () => void {
  let pending: ReturnType<typeof setTimeout> | undefined;
  const watchers: FSWatcher[] = [];
  const changed = (file: string): void => {
    if (!server.isCubeFile(file)) {
      return;
    }
    clearTimeout(pending);
    pending = setTimeout(() => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(CUBE_CHANGED_EVENT);
      }
    }, CHANGE_DEBOUNCE_MS);
  };
  for (const directory of server.watched()) {
    try {
      const watcher = watch(directory, { recursive: true }, (_event, name) => {
        if (name !== null) {
          changed(join(directory, name));
        }
      });
      watcher.on("error", (error) => {
        console.warn(`Stopped watching ${directory}: ${String(error)}`);
        watcher.close();
      });
      watchers.push(watcher);
    } catch (error) {
      console.warn(`Not watching ${directory}: ${String(error)}`);
    }
  }
  return () => {
    clearTimeout(pending);
    for (const watcher of watchers) {
      watcher.close();
    }
  };
}

function isAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === `${SCHEME}:` && parsed.host === HOST;
  } catch {
    return false;
  }
}

function fromApp(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url;
  return url !== undefined && isAppUrl(url);
}

function serveCubes(server: WorkbenchServer, recent: RecentCubes): void {
  let unwatch = watchCube(server);
  const switchTo = async (dir: string): Promise<CubeRef> => {
    const folder = await server.open(dir);
    unwatch();
    unwatch = watchCube(server);
    const ref = refOf(folder);
    await recent.opened(ref);
    return ref;
  };
  const list = async (): Promise<CubeList> => ({
    current: refOf(server.cube()),
    recent: (await recent.load()).cubes,
  });
  const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {
    [CUBES_CHANNEL.list]: list,
    [CUBES_CHANNEL.create]: async (name) => {
      if (typeof name !== "string") {
        throw new TypeError("A cube needs a name");
      }
      const { format, size } = server.cube().config;
      const folder = await createCubeFolder(cubesHome(), name, { format, size });
      return switchTo(folder.dir);
    },
    [CUBES_CHANNEL.openFolder]: async () => {
      const dir = await pickFolder();
      return dir === undefined ? undefined : switchTo(dir);
    },
    [CUBES_CHANNEL.switchTo]: async (dir) => {
      const known = (await recent.load()).cubes.some((cube) => cube.dir === dir);
      if (typeof dir !== "string" || !known) {
        throw new TypeError("Only a cube from the recent list can be opened this way");
      }
      return switchTo(dir);
    },
    [CUBES_CHANNEL.offlineStatus]: async (dir) => {
      const known = (await recent.load()).cubes.some((cube) => cube.dir === dir);
      if (typeof dir !== "string" || (!known && dir !== server.cube().dir)) {
        throw new TypeError("Only a cube from the recent list has an offline status");
      }
      return server.offlineStatus(dir);
    },
    [CUBES_CHANNEL.remove]: async (dir) => {
      if (typeof dir !== "string") {
        throw new TypeError("No cube folder given");
      }
      if (dir === server.cube().dir) {
        throw new Error("The open cube can't be removed from the list");
      }
      await recent.remove(dir);
      return list();
    },
  };
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!fromApp(event)) {
        throw new Error("Not allowed");
      }
      return handler(...args);
    });
  }
  void recent.opened(refOf(server.cube()));
}

function lockDown(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-navigate", (event, target) => {
      if (!isAppUrl(target)) {
        event.preventDefault();
      }
    });
    contents.setWindowOpenHandler(({ url }) => {
      const target = new URL(url);
      if (target.protocol === "https:" && EXTERNAL_HOSTS.has(target.hostname)) {
        void shell.openExternal(url);
      }
      return { action: "deny" };
    });
  });
}

const hidden = process.env["CUBE_DESKTOP_HIDDEN"] === "1";

interface TestNetwork {
  cut: boolean;
}

function scryfallFetch(): typeof fetch {
  if (!hidden) {
    return fetch;
  }
  const network: TestNetwork = { cut: false };
  (globalThis as { cubeTestNetwork?: TestNetwork }).cubeTestNetwork = network;
  return (input, init) =>
    network.cut ? Promise.reject(new TypeError("fetch failed")) : fetch(input, init);
}

function openWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    show: !hidden,
    webPreferences: {
      preload: join(import.meta.dirname, "..", "preload", "index.cjs"),
    },
  });
  void window.loadURL(`${ORIGIN}/`);
}

async function start(): Promise<void> {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on("second-instance", () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  });
  if (hidden) {
    app.dock?.hide();
  }
  await app.whenReady();
  lockDown();
  const recent = new RecentCubes(app.getPath("userData"));
  const cubeDir = await firstCube(recent);
  if (cubeDir === undefined) {
    app.quit();
    return;
  }
  const cacheDir = process.env["CUBE_CACHE_DIR"] ?? join(app.getPath("userData"), "cache");
  let server: WorkbenchServer;
  try {
    server = await createWorkbenchServer({
      cubeDir,
      cacheDir: join(cacheDir, "scryfall"),
      imageCacheDir: join(cacheDir, "scryfall-images"),
      fetch: scryfallFetch(),
    });
  } catch (error) {
    dialog.showErrorBox("Could not open the cube", `${cubeDir}\n\n${String(error)}`);
    app.quit();
    return;
  }
  serve(server);
  serveCubes(server, recent);
  openWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openWindow();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

void start();
