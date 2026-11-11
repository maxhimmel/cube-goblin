import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve, sep } from "node:path";
import type {
  AddResult,
  BatchResult,
  BoardResult,
  FiltersResult,
  CubePaths,
  FoundCard,
  Printing,
  SearchResult,
  TagResult,
  UpdateResult,
  VersionResult,
  Workbench,
  WorkbenchCard,
} from "@repo/cube";
import {
  CURRENT,
  FUNCTION_ORACLE_TAG_IDS,
  addCard,
  compareVersions,
  listVersions,
  saveVersion,
  cardChangesSchema,
  functionTags,
  cardPatchSchema,
  changeTag,
  createTag,
  cubePaths,
  patchCard,
  patchCards,
  loadBoard,
  loadFilters,
  readCards,
  readConfig,
  readTags,
  saveBoard,
  saveFilters,
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
import type { Card } from "@repo/scryfall";
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

async function loadWorkbench(paths: CubePaths, client: ScryfallClient): Promise<Workbench> {
  const [entries, vocabulary, config] = await Promise.all([
    readCards(paths),
    readTags(paths),
    readConfig(paths),
  ]);
  const { cards: byOracle, unresolved } = await client.forEntries(entries);
  if (unresolved.length > 0) {
    console.warn(
      `Showing the default printing for ${String(unresolved.length)} card(s) whose chosen printing could not be loaded`,
    );
  }
  const workbenchCards: WorkbenchCard[] = [];
  for (const entry of entries) {
    const card = byOracle.get(entry.oracleId);
    const fields = card ? displayFields(card) : undefined;
    if (!card || !fields) {
      throw new Error(`Missing Scryfall data or image for ${entry.name}`);
    }
    workbenchCards.push({
      slug: slugify(entry.name),
      name: entry.name,
      oracleId: entry.oracleId,
      status: entry.status,
      ...(entry.printing === undefined ? {} : { printing: entry.printing }),
      shown: {
        id: card.id,
        setName: card.set_name ?? card.set,
        collectorNumber: card.collector_number,
      },
      ...fields,
      image: localImageUrl(fields.image),
      imageLarge: localImageUrl(fields.imageLarge),
      tags: entry.tags,
      notes: entry.notes,
    });
  }
  return {
    cards: workbenchCards,
    vocabulary,
    size: config.size,
  };
}

type WriteResult =
  UpdateResult | TagResult | BatchResult | AddResult | BoardResult | FiltersResult | VersionResult;
type Write = (body: unknown) => Promise<WriteResult>;

function written(result: Extract<WriteResult, { ok: true }>): unknown {
  if ("card" in result) {
    return result.card;
  }
  if ("board" in result) {
    return result.board;
  }
  if ("filters" in result) {
    return result.filters;
  }
  if ("version" in result) {
    return result.version;
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
  remembered: Map<string, Card[]>,
): Promise<Printing[] | undefined> {
  const entry = (await readCards(paths)).find((card) => slugify(card.name) === slug);
  if (!entry) {
    return undefined;
  }
  let cards = remembered.get(entry.oracleId);
  if (!cards) {
    cards = await client.printings(entry.oracleId);
    remembered.set(entry.oracleId, cards);
  }
  return cards.flatMap((card) => printingSummary(card) ?? []);
}

function chosenPrintings(body: unknown): string[] {
  const changes = cardChangesSchema.safeParse(body);
  const patches = changes.success
    ? changes.data.changes.map((change) => change.patch)
    : [cardPatchSchema.safeParse(body).data];
  return patches.flatMap((patch) => (typeof patch?.printing === "string" ? [patch.printing] : []));
}

async function keepPrintings(
  ids: readonly string[],
  client: ScryfallClient,
  remembered: Map<string, Card[]>,
): Promise<Card[]> {
  const known = new Map([...remembered.values()].flat().map((card) => [card.id, card]));
  const cards: Card[] = [];
  const unknown: string[] = [];
  for (const id of ids) {
    const card = known.get(id);
    if (card) {
      await client.rememberPrinting(card);
      cards.push(card);
    } else {
      unknown.push(id);
    }
  }
  if (unknown.length > 0) {
    cards.push(...(await client.byIds(unknown)).cards);
  }
  return cards;
}

function warmImages(cards: readonly Card[], images: ImageCache): void {
  for (const card of cards) {
    const fields = displayFields(card);
    if (fields) {
      void Promise.all([images.get(fields.image), images.get(fields.imageLarge)]).catch(
        () => undefined,
      );
    }
  }
}

function writeRoute(paths: CubePaths, client: ScryfallClient, oracleTags: OracleTagStore) {
  const lookup = async (oracleId: string): Promise<FoundCard | undefined> => {
    const [{ cards }, tags] = await Promise.all([
      client.byOracleIds([oracleId]),
      oracleTags.load(FUNCTION_ORACLE_TAG_IDS),
    ]);
    const card = cards[0];
    return card
      ? {
          name: card.name,
          functionTags: functionTags(
            { oracleId, producedMana: card.produced_mana ?? [] },
            tags.index,
          ),
        }
      : undefined;
  };
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
    if (url === "/api/filters" && method === "PUT") {
      return (body) => saveFilters(paths, body);
    }
    if (url === "/api/tags" && method === "POST") {
      return (body) => createTag(paths, body);
    }
    if (url === "/api/versions" && method === "POST") {
      return (body) => saveVersion(paths, body);
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
      const route = writeRoute(paths, client, oracleTags);
      const remembered = new Map<string, Card[]>();
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
        if (url === "/api/versions" && req.method === "GET") {
          listVersions(paths).then(
            (versions) => {
              send(res, 200, versions);
            },
            (error: unknown) => {
              send(res, 500, { error: String(error) });
            },
          );
          return;
        }
        if (url === "/api/versions/compare" && req.method === "GET") {
          compareVersions(
            paths,
            requestUrl.searchParams.get("from") ?? CURRENT,
            requestUrl.searchParams.get("to") ?? CURRENT,
          ).then(
            (result) => {
              if (result.ok) {
                send(res, 200, result.diff);
              } else {
                send(res, result.status, { error: result.error });
              }
            },
            (error: unknown) => {
              send(res, 500, { error: String(error) });
            },
          );
          return;
        }
        if (url === "/api/filters" && req.method === "GET") {
          loadFilters(paths).then(
            (filters) => {
              send(res, 200, filters);
            },
            (error: unknown) => {
              send(res, 500, { error: String(error) });
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
              const kept = await keepPrintings(
                chosenPrintings(body.value),
                client,
                remembered,
              ).catch(() => []);
              warmImages(kept, images);
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
