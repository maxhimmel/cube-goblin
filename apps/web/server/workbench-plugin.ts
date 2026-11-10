import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve, sep } from "node:path";
import type {
  AddResult,
  BatchResult,
  BoardResult,
  CardEntry,
  CubePaths,
  Printing,
  SearchResult,
  TagResult,
  UpdateResult,
  Workbench,
  WorkbenchCard,
} from "@repo/cube";
import {
  FUNCTION_ORACLE_TAG_IDS,
  addCard,
  cardFunctions,
  changeTag,
  createTag,
  cubePaths,
  patchCard,
  patchCards,
  loadBoard,
  readCards,
  readConfig,
  readSections,
  readTags,
  saveBoard,
  slugify,
} from "@repo/cube";
import {
  FileCache,
  OracleTagStore,
  ScryfallClient,
  ScryfallError,
  displayFields,
  printingSummary,
} from "@repo/scryfall";
import type { Plugin } from "vite";
import { IMAGE_ROUTE, ImageCache, isAllowedImage, localImageUrl } from "./image-cache.ts";

const USER_AGENT = "MaxsCubeWorkbench/0.1.0";
const CUBE_CHANGED_EVENT = "cube:changed";
const CARD_ROUTE = /^\/api\/cards\/([a-z0-9-]+)$/u;
const TAG_ROUTE = /^\/api\/tags\/([a-z0-9-]+)$/u;
const PRINTINGS_ROUTE = /^\/api\/cards\/([a-z0-9-]+)\/printings$/u;
const CHANGE_DEBOUNCE_MS = 100;
const SEARCH_LIMIT = 24;

export interface WorkbenchOptions {
  repoRoot: string;
  cacheDir: string;
  imageCacheDir: string;
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

async function loadWorkbench(
  paths: CubePaths,
  client: ScryfallClient,
  oracleTags: OracleTagStore,
): Promise<Workbench> {
  const [entries, sections, vocabulary, config] = await Promise.all([
    readCards(paths),
    readSections(paths),
    readTags(paths),
    readConfig(paths),
  ]);
  const [{ cards: byOracle }, tags] = await Promise.all([
    client.forEntries(entries),
    oracleTags.load(FUNCTION_ORACLE_TAG_IDS),
  ]);
  const workbenchCards: WorkbenchCard[] = [];
  for (const entry of entries) {
    const card = byOracle.get(entry.oracleId);
    const fields = card ? displayFields(card) : undefined;
    if (!card || !fields) {
      throw new Error(`Missing Scryfall data or image for ${entry.name}`);
    }
    const { producedMana, ...display } = fields;
    workbenchCards.push({
      slug: slugify(entry.name),
      name: entry.name,
      oracleId: entry.oracleId,
      status: entry.status,
      ...(entry.section === undefined ? {} : { section: entry.section }),
      ...(entry.printing === undefined ? {} : { printing: entry.printing }),
      shown: {
        id: card.id,
        setName: card.set_name ?? card.set,
        collectorNumber: card.collector_number,
      },
      ...display,
      functions: cardFunctions({ oracleId: entry.oracleId, producedMana }, tags.index),
      image: localImageUrl(fields.image),
      imageLarge: localImageUrl(fields.imageLarge),
      tags: entry.tags,
      notes: entry.notes,
    });
  }
  return {
    cards: workbenchCards,
    sections,
    vocabulary,
    size: config.size,
    ...(tags.fetchedAt === undefined
      ? {}
      : { functionsAsOf: new Date(tags.fetchedAt).toISOString() }),
  };
}

type WriteResult = UpdateResult | TagResult | BatchResult | AddResult | BoardResult;
type Write = (body: unknown) => Promise<WriteResult>;

function written(result: Extract<WriteResult, { ok: true }>): unknown {
  if ("card" in result) {
    return result.card;
  }
  if ("board" in result) {
    return result.board;
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
        image: localImageUrl(fields.image),
        inCube: inCube.has(card.oracle_id),
      });
    }
  }
  return results;
}

async function listPrintings(
  paths: CubePaths,
  client: ScryfallClient,
  slug: string,
  remembered: Map<string, Printing[]>,
): Promise<Printing[] | undefined> {
  const entry = (await readCards(paths)).find((card) => slugify(card.name) === slug);
  if (!entry) {
    return undefined;
  }
  const known = remembered.get(entry.oracleId);
  if (known) {
    return known;
  }
  const printings = (await client.printings(entry.oracleId)).flatMap(
    (card) => printingSummary(card) ?? [],
  );
  remembered.set(entry.oracleId, printings);
  return printings;
}

async function keepPrintings(
  entries: readonly CardEntry[],
  client: ScryfallClient,
  images: ImageCache,
): Promise<void> {
  const ids = entries.flatMap((entry) => entry.printing ?? []);
  if (ids.length === 0) {
    return;
  }
  const { cards } = await client.byIds(ids);
  for (const card of cards) {
    const fields = displayFields(card);
    if (fields) {
      await Promise.all([images.get(fields.image), images.get(fields.imageLarge)]);
    }
  }
}

function writeRoute(paths: CubePaths, client: ScryfallClient) {
  const lookup = async (oracleId: string): Promise<string | undefined> =>
    (await client.byOracleIds([oracleId])).cards[0]?.name;
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
    if (url === "/api/board" && method === "PUT") {
      return (body) => saveBoard(paths, body);
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
      const oracleTags = new OracleTagStore({
        client,
        file: join(options.cacheDir, "oracle-tags.json"),
      });
      const images = new ImageCache(options.imageCacheDir, USER_AGENT);
      const route = writeRoute(paths, client);
      const remembered = new Map<string, Printing[]>();
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
        if (url === IMAGE_ROUTE && req.method === "GET") {
          const remote = requestUrl.searchParams.get("u") ?? "";
          if (!isAllowedImage(remote)) {
            send(res, 400, { error: "Only Scryfall card images are served" });
            return;
          }
          images.get(remote).then(
            (image) => {
              res.statusCode = 200;
              res.setHeader("Content-Type", image.type);
              res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
              res.end(image.body);
            },
            (error: unknown) => {
              send(res, 502, { error: error instanceof Error ? error.message : String(error) });
            },
          );
          return;
        }
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
        if (url === "/api/board" && req.method === "GET") {
          loadBoard(paths).then(
            (board) => {
              send(res, 200, board);
            },
            (error: unknown) => {
              send(res, 500, { error: String(error) });
            },
          );
          return;
        }
        const printingsOf = PRINTINGS_ROUTE.exec(url)?.[1];
        if (printingsOf !== undefined && req.method === "GET") {
          listPrintings(paths, client, printingsOf, remembered).then(
            (printings) => {
              if (printings === undefined) {
                send(res, 404, { error: `No card "${printingsOf}"` });
              } else {
                send(res, 200, printings);
              }
            },
            (error: unknown) => {
              const status = error instanceof ScryfallError ? scryfallStatus(error.status) : 502;
              send(res, status, { error: error instanceof Error ? error.message : String(error) });
            },
          );
          return;
        }
        if (url === "/api/cube" && req.method === "GET") {
          loadWorkbench(paths, client, oracleTags).then(
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
              const saved =
                "cards" in result ? result.cards : "card" in result ? [result.card] : [];
              void keepPrintings(saved, client, images).catch(() => undefined);
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
