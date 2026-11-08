import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve, sep } from "node:path";
import type { CubePaths, Workbench, WorkbenchCard } from "@repo/cube";
import { cubePaths, readCards, readSections, slugify, updateCard } from "@repo/cube";
import { FileCache, ScryfallClient, displayFields } from "@repo/scryfall";
import type { Plugin } from "vite";

const USER_AGENT = "MaxsCubeWorkbench/0.1.0";
const CUBE_CHANGED_EVENT = "cube:changed";
const CARD_ROUTE = /^\/api\/cards\/([a-z0-9-]+)$/u;

export interface WorkbenchOptions {
  repoRoot: string;
  cacheDir: string;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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

      server.watcher.add([paths.root, paths.configFile]);
      server.watcher.on("all", (_event, file) => {
        const path = resolve(file);
        if (path.startsWith(cubeRoot) || path === configFile) {
          server.ws.send(CUBE_CHANGED_EVENT);
        }
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
        if (slug !== undefined && req.method === "PUT") {
          readBody(req)
            .then((body) => updateCard(paths, slug, body))
            .then(
              (result) => {
                if (result.ok) {
                  send(res, 200, result.card);
                } else {
                  send(res, result.status, { error: result.error });
                }
              },
              (error: unknown) => {
                send(res, 400, { error: String(error) });
              },
            );
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
