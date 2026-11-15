import { watch } from "node:fs";
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow, app, dialog, net, protocol, session, shell } from "electron";
import { CHANGE_DEBOUNCE_MS, CUBE_CHANGED_EVENT, createWorkbenchServer } from "@repo/server";
import type { WorkbenchServer } from "@repo/server";

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

function settingsFile(): string {
  return join(app.getPath("userData"), "settings.json");
}

async function hasCube(root: string): Promise<boolean> {
  try {
    return (await stat(join(root, "cube"))).isDirectory();
  } catch {
    return false;
  }
}

async function rememberedRoot(): Promise<string | undefined> {
  try {
    const settings: unknown = JSON.parse(await readFile(settingsFile(), "utf8"));
    if (typeof settings === "object" && settings !== null && "repoRoot" in settings) {
      const { repoRoot } = settings;
      return typeof repoRoot === "string" ? repoRoot : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function chooseRoot(): Promise<string | undefined> {
  const fromEnv = process.env["CUBE_REPO_ROOT"];
  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv;
  }
  if (!app.isPackaged) {
    return resolve(app.getAppPath(), "..", "..");
  }
  const remembered = await rememberedRoot();
  if (remembered !== undefined && (await hasCube(remembered))) {
    return remembered;
  }
  const picked = await dialog.showOpenDialog({
    title: "Open the folder that holds your cube/ folder",
    properties: ["openDirectory"],
  });
  const root = picked.filePaths[0];
  if (picked.canceled || root === undefined || !(await hasCube(root))) {
    return undefined;
  }
  await mkdir(dirname(settingsFile()), { recursive: true });
  await writeFile(settingsFile(), `${JSON.stringify({ repoRoot: root }, null, 2)}\n`);
  return root;
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

function watchCube(server: WorkbenchServer): void {
  let pending: ReturnType<typeof setTimeout> | undefined;
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
  for (const path of server.watched) {
    void stat(path).then(
      (info) => {
        const directory = info.isDirectory() ? path : dirname(path);
        const watcher = watch(directory, { recursive: info.isDirectory() }, (_event, name) => {
          if (name !== null) {
            changed(join(directory, name));
          }
        });
        watcher.on("error", (error) => {
          console.warn(`Stopped watching ${directory}: ${String(error)}`);
          watcher.close();
        });
      },
      (error: unknown) => {
        console.warn(`Not watching ${path}: ${String(error)}`);
      },
    );
  }
}

function lockDown(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-navigate", (event, target) => {
      if (new URL(target).origin !== ORIGIN) {
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
  const repoRoot = await chooseRoot();
  if (repoRoot === undefined) {
    app.quit();
    return;
  }
  const cacheDir = process.env["CUBE_CACHE_DIR"] ?? join(app.getPath("userData"), "cache");
  const server = createWorkbenchServer({
    repoRoot,
    cacheDir: join(cacheDir, "scryfall"),
    imageCacheDir: join(cacheDir, "scryfall-images"),
  });
  serve(server);
  watchCube(server);
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
