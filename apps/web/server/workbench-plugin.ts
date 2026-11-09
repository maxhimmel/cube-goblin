import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve, sep } from "node:path";
import type {
  AddResult,
  BatchResult,
  CubePaths,
  SearchResult,
  TagResult,
  UpdateResult,
  Workbench,
  WorkbenchCard,
} from "@repo/cube";
import {
  addCard,
  changeTag,
  createTag,
  cubePaths,
  patchCard,
  patchCards,
  readCards,
  readConfig,
  readSections,
  readTags,
  slugify,
} from "@repo/cube";
import { FileCache, ScryfallClient, ScryfallError, displayFields } from "@repo/scryfall";
import type { Plugin } from "vite";

const USER_AGENT = "MaxsCubeWorkbench/0.1.0";
const CUBE_CHANGED_EVENT = "cube:changed";
const CARD_ROUTE = /^\/api\/cards\/([a-z0-9-]+)$/u;
const TAG_ROUTE = /^\/api\/tags\/([a-z0-9-]+)$/u;
const CHANGE_DEBOUNCE_MS = 100;
const SEARCH_LIMIT = 24;

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
  const [entries, sections, vocabulary, config] = await Promise.all([
    readCards(paths),
    readSections(paths),
    readTags(paths),
    readConfig(paths),
  ]);
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
  return { cards: workbenchCards, sections, vocabulary, size: config.size };
}

type WriteResult = UpdateResult | TagResult | BatchResult | AddResult;
type Write = (body: unknown) => Promise<WriteResult>;

function written(result: Extract<WriteResult, { ok: true }>): unknown {
  if ("card" in result) {
    return result.card;
  }
  return "cards" in result ? result.cards : result.tag;
}

function scryfallStatus(status: number): number {
  return status === 400 || status === 404 || status === 429 ? status : 502;
}

async function search(
  paths: CubePaths,
  client: ScryfallClient,
  query: string,
): Promise<SearchResult[]> {
  if (query.trim().length === 0) {
    return [];
  }
  const inCube = new Set((await readCards(paths)).map((card) => card.oracleId));
  let found;
  try {
    found = await client.search(query, { limit: SEARCH_LIMIT });
  } catch (error) {
    if (error instanceof ScryfallError && error.status === 404) {
      return [];
    }
    throw error;
  }
  const results: SearchResult[] = [];
  for (const card of found) {
    const fields = displayFields(card);
    if (card.oracle_id !== undefined && fields) {
      results.push({
        oracleId: card.oracle_id,
        name: card.name,
        manaCost: fields.manaCost,
        typeLine: fields.typeLine,
        image: fields.image,
        inCube: inCube.has(card.oracle_id),
      });
    }
  }
  return results;
}

function writeRoute(paths: CubePaths, client: ScryfallClient) {
  const lookup = async (oracleId: string): Promise<string | undefined> =>
    (await client.collection([{ oracle_id: oracleId }])).cards[0]?.name;
  return (url: string, method: string | undefined): Write | undefined => {
    if (url === "/api/cards" && method === "POST") {
      return (body) => addCard(paths, body, lookup);
    }
    if (url === "/api/cards" && method === "PATCH") {
      return (body) => patchCards(paths, body);
    }
    const card = CARD_ROUTE.exec(url)?.[1];
    if (card !== undefined && method === "PATCH") {
      return (body) => patchCard(paths, card, body);
    }
    const tag = TAG_ROUTE.exec(url)?.[1];
    if (tag !== undefined && method === "PATCH") {
      return (body) => changeTag(paths, tag, body);
    }
    if (url === "/api/tags" && method === "POST") {
      return (body) => createTag(paths, body);
    }
    return undefined;
  };
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
      const route = writeRoute(paths, client);
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
        const requestUrl = new URL(req.url ?? "/", "http://workbench.local");
        const url = requestUrl.pathname;
        if (url === "/api/search" && req.method === "GET") {
          search(paths, client, requestUrl.searchParams.get("q") ?? "").then(
            (results) => {
              send(res, 200, results);
            },
            (error: unknown) => {
              const status = error instanceof ScryfallError ? scryfallStatus(error.status) : 502;
              send(res, status, { error: error instanceof Error ? error.message : String(error) });
            },
          );
          return;
        }
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
        const write = route(url, req.method);
        if (write !== undefined) {
          const run = writes.then(async () => {
            const body = parseJson(await readBody(req));
            if (!body.ok) {
              send(res, 400, { error: "Body is not valid JSON" });
              return;
            }
            const result = await write(body.value);
            if (result.ok) {
              send(res, 200, written(result));
            } else {
              send(res, result.status, { error: result.error });
            }
          });
          writes = run.catch(() => undefined);
          run.catch((error: unknown) => {
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
