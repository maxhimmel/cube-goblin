import type { FSWatcher } from "node:fs";
import { watch } from "node:fs";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type { IpcMainInvokeEvent } from "electron";
import { BrowserWindow, app, dialog, ipcMain, net, protocol, session, shell } from "electron";
import { createCubeFolder, findCubeFolder } from "@repo/cube";
import {
  CHANGE_DEBOUNCE_MS,
  CUBE_CHANGED_EVENT,
  OPEN_FOLDER_CHANNEL,
  recentCubesFor,
  createCubeHostServer,
  startingCube,
} from "@repo/server";
import type { CubeHostServer, CubeLibrary, RecentCubes } from "@repo/server";

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

async function firstCube(recent: RecentCubes): Promise<string | undefined> {
  const fromEnv = process.env["CUBE_DIR"];
  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv;
  }
  const devCube = resolve(app.getAppPath(), "..", "..", "cube");
  const found = await startingCube(recent, app.isPackaged ? [] : [devCube]);
  if (found !== undefined) {
    return found;
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

function serve(host: CubeHostServer): void {
  const root = rendererDir();
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== HOST) {
      return notFound();
    }
    return (await host.handle(request)) ?? serveFile(root, url.pathname);
  });
}

function watchCube(server: CubeHostServer["server"]): () => void {
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

function serveCubes(server: CubeHostServer["server"], library: CubeLibrary): void {
  let unwatch = watchCube(server);
  library.onSwitch(() => {
    unwatch();
    unwatch = watchCube(server);
  });
  ipcMain.handle(OPEN_FOLDER_CHANNEL, async (event) => {
    if (!fromApp(event)) {
      throw new Error("Not allowed");
    }
    const dir = await pickFolder();
    return dir === undefined ? undefined : library.open(dir);
  });
}

function lockDown(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === "clipboard-sanitized-write");
  });
  session.defaultSession.setPermissionCheckHandler(
    (_contents, permission) => permission === "clipboard-sanitized-write",
  );
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
  const pinned = (process.env["CUBE_DIR"] ?? "") !== "" && (userDataOverride ?? "") === "";
  const recent = recentCubesFor(app.getPath("userData"), pinned);
  const cubeDir = await firstCube(recent);
  if (cubeDir === undefined) {
    app.quit();
    return;
  }
  const cacheDir = process.env["CUBE_CACHE_DIR"] ?? join(app.getPath("userData"), "cache");
  let host: CubeHostServer;
  try {
    host = await createCubeHostServer({
      cubeDir,
      cacheDir: join(cacheDir, "scryfall"),
      imageCacheDir: join(cacheDir, "scryfall-images"),
      fetch: scryfallFetch(),
      home: cubesHome(),
      recent,
      openByPath: false,
      hosts: [HOST],
    });
  } catch (error) {
    dialog.showErrorBox("Could not open the cube", `${cubeDir}\n\n${String(error)}`);
    app.quit();
    return;
  }
  serve(host);
  serveCubes(host.server, host.library);
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
