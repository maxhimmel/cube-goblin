import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve, sep } from "node:path";
import type { CubePaths, Workbench, WorkbenchCard } from "@repo/cube";
import { cubePaths, patchCard, readCards, readSections, slugify } from "@repo/cube";
import { FileCache, ScryfallClient, displayFields } from "@repo/scryfall";
import type { Plugin } from "vite";

const USER_AGENT = "MaxsCubeWorkbench/0.1.0";
const CUBE_CHANGED_EVENT = "cube:changed";
const CARD_ROUTE = /^\/api\/cards\/([a-z0-9-]+)$/u;
const CHANGE_DEBOUNCE_MS = 100;

export interface WorkbenchOptions {
  repoRoot: string;
  cacheDir: string;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

async function loadWorkbench(paths: CubePaths, client: ScryfallClient): Promise<Workbench> {
  const [entries, sections] = await Promise.all([readCards(paths), readSections(paths)]);
  const { cards } = await client.collection(
    entries.map((entry) => ({ oracle_id: entry.oracleId })),
  );
  const byOracle = new Map(cards.map((card) => [card.oracle_id, card]));
  const workbenchCards: WorkbenchCard[] = [];
  for (const entry of entries) {
    const card = byOracle.get(entry.oracleId);
    const fields = card ? displayFields(card) : undefined;
    if (!fields) {
      throw new Error(`Missing Scryfall data or image for ${entry.name}`);
    }
    workbenchCards.push({
      slug: slugify(entry.name),
      name: entry.name,
      oracleId: entry.oracleId,
      status: entry.status,
      ...(entry.section === undefined ? {} : { section: entry.section }),
      ...fields,
      tags: entry.tags,
      notes: entry.notes,
    });
  }
  return { cards: workbenchCards, sections };
}

export function workbench(options: WorkbenchOptions): Plugin {
  return {
    name: "repo:workbench",
    apply: "serve",
    configureServer(server) {
      const paths = cubePaths(options.repoRoot);
      const client = new ScryfallClient({
        userAgent: USER_AGENT,
        cache: new FileCache(options.cacheDir),
      });
      const cubeRoot = resolve(paths.root) + sep;
      const configFile = resolve(paths.configFile);

      let writes: Promise<void> = Promise.resolve();
      let pending: ReturnType<typeof setTimeout> | undefined;

      server.watcher.add([paths.root, paths.configFile]);
      server.watcher.on("all", (_event, file) => {
        const path = resolve(file);
        if (path.endsWith(".tmp") || !(path.startsWith(cubeRoot) || path === configFile)) {
          return;
        }
        clearTimeout(pending);
        pending = setTimeout(() => {
          server.ws.send(CUBE_CHANGED_EVENT);
        }, CHANGE_DEBOUNCE_MS);
      });

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url === "/api/cube" && req.method === "GET") {
          loadWorkbench(paths, client).then(
            (data) => {
              send(res, 200, data);
            },
            (error: unknown) => {
              send(res, 500, { error: String(error) });
            },
          );
          return;
        }
        const slug = CARD_ROUTE.exec(url)?.[1];
        if (slug !== undefined && req.method === "PATCH") {
          const write = writes.then(async () => {
            const body = parseJson(await readBody(req));
            if (!body.ok) {
              send(res, 400, { error: "Body is not valid JSON" });
              return;
            }
            const result = await patchCard(paths, slug, body.value);
            if (result.ok) {
              send(res, 200, result.card);
            } else {
              send(res, result.status, { error: result.error });
            }
          });
          writes = write.catch(() => undefined);
          write.catch((error: unknown) => {
            send(res, 500, { error: String(error) });
          });
          return;
        }
        if (url.startsWith("/api/")) {
          send(res, 404, { error: `No route ${req.method ?? ""} ${url}` });
          return;
        }
        next();
      });
    },
  };
}
