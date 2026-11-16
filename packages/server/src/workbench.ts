import { join, resolve, sep } from "node:path";
import type {
  AddResult,
  BatchResult,
  BoardResult,
  ConfigResult,
  FiltersResult,
  LayoutsResult,
  LogMessage,
  LogState,
  LogStats,
  CubeFolder,
  CubePaths,
  FoundCard,
  OfflineStatus,
  Printing,
  SearchResult,
  TagResult,
  UpdateResult,
  VersionResult,
  RevertResult,
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
  openCubeFolder,
  patchCard,
  patchCards,
  loadBoard,
  loadFilters,
  loadLayouts,
  stateStats,
  readCards,
  readLog,
  readLogState,
  recordEdit,
  revertEntries,
  readConfig,
  readTags,
  saveBoard,
  saveConfig,
  saveFilters,
  saveLayouts,
  slugify,
} from "@repo/cube";
import {
  FileCache,
  OracleTagStore,
  ScryfallClient,
  ScryfallError,
  displayFields,
  isUnreachable,
  printingSummary,
} from "@repo/scryfall";
import type { Card } from "@repo/scryfall";
import { IMAGE_ROUTE, ImageCache, isAllowedImage, localImageUrl } from "./image-cache.ts";
import type { ImportDeps, ImportResult } from "./importer.ts";
import { exportCube, previewImport, runImport } from "./importer.ts";
import type { OfflineDeps } from "./offline.ts";
import { OfflineRuns, Reachability, cacheStatus } from "./offline.ts";
import type { RouteContext, RouteRow } from "./routes.ts";
import { json } from "./routes.ts";

const USER_AGENT = "MaxsCubeWorkbench/0.1.0";
const CARD_ROUTE = /^\/api\/cards\/([a-z0-9-]+)$/u;
const TAG_ROUTE = /^\/api\/tags\/([a-z0-9-]+)$/u;
const PRINTINGS_ROUTE = /^\/api\/cards\/([a-z0-9-]+)\/printings$/u;
export const CHANGE_DEBOUNCE_MS = 100;
const SEARCH_LIMIT = 24;

export interface WorkbenchOptions {
  cubeDir: string;
  cacheDir: string;
  imageCacheDir: string;
  fetch?: typeof fetch;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  | UpdateResult
  | TagResult
  | BatchResult
  | AddResult
  | BoardResult
  | FiltersResult
  | LayoutsResult
  | ConfigResult
  | VersionResult
  | RevertResult
  | ImportResult;
type Write = (body: unknown) => Promise<WriteResult>;

interface Route {
  write: Write;
  logged: boolean;
}

const SUBJECT_HEADER = "x-log-subject";
const CUBE_HEADER = "x-cube-id";
const BODY_HEADER = "x-log-body";

function header(request: Request, name: string): string | undefined {
  const value = request.headers.get(name);
  if (value === null || value === "") {
    return undefined;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function logMessage(request: Request): LogMessage {
  return { subject: header(request, SUBJECT_HEADER), body: header(request, BODY_HEADER) };
}

export function statsOf(client: ScryfallClient) {
  return async (state: LogState): Promise<LogStats> => {
    const { cards } = await client.byOracleIds(state.cards.map((card) => card.oracleId));
    const byOracle = new Map(cards.map((card) => [card.oracle_id, card]));
    return stateStats(state, (oracleId) => {
      const card = byOracle.get(oracleId);
      return card ? displayFields(card) : undefined;
    });
  };
}

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
  if ("layouts" in result) {
    return result.layouts;
  }
  if ("config" in result) {
    return result.config;
  }
  if ("version" in result) {
    return result.version;
  }
  if ("entry" in result) {
    return result.entry;
  }
  if ("imported" in result) {
    return result.imported;
  }
  return "cards" in result ? result.cards : result.tag;
}

function unreachableText(error: unknown, what: string): string | undefined {
  return isUnreachable(error) ? `Scryfall can't be reached, so ${what}` : undefined;
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
  return cards.flatMap((card) => {
    const printing = printingSummary(card);
    return printing
      ? [
          {
            ...printing,
            image: localImageUrl(printing.image),
            imageLarge: localImageUrl(printing.imageLarge),
          },
        ]
      : [];
  });
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

interface WriteRow {
  method: string;
  path: string | RegExp;
  example: string;
  logged: boolean;
  write: (paths: CubePaths, params: readonly string[], message: LogMessage) => Write;
}

function writeRows(
  client: ScryfallClient,
  oracleTags: OracleTagStore,
  stats: (state: LogState) => Promise<LogStats>,
  importDeps: ImportDeps,
): WriteRow[] {
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
  const first = (params: readonly string[]): string => params[0] ?? "";
  return [
    {
      method: "POST",
      path: "/api/log/revert",
      example: "/api/log/revert",
      logged: false,
      write: (paths, _params, message) => (body) => revertEntries(paths, body, stats, message),
    },
    {
      method: "POST",
      path: "/api/import",
      example: "/api/import",
      logged: true,
      write: (paths) => (body) => runImport(paths, body, importDeps),
    },
    {
      method: "POST",
      path: "/api/cards",
      example: "/api/cards",
      logged: true,
      write: (paths) => (body) => addCard(paths, body, lookup),
    },
    {
      method: "PATCH",
      path: "/api/cards",
      example: "/api/cards",
      logged: true,
      write: (paths) => (body) => patchCards(paths, body),
    },
    {
      method: "PATCH",
      path: CARD_ROUTE,
      example: "/api/cards/shock",
      logged: true,
      write: (paths, params) => (body) => patchCard(paths, first(params), body),
    },
    {
      method: "PATCH",
      path: TAG_ROUTE,
      example: "/api/tags/removal",
      logged: true,
      write: (paths, params) => (body) => changeTag(paths, first(params), body),
    },
    {
      method: "PUT",
      path: "/api/board",
      example: "/api/board",
      logged: true,
      write: (paths) => (body) => saveBoard(paths, body),
    },
    {
      method: "PUT",
      path: "/api/filters",
      example: "/api/filters",
      logged: true,
      write: (paths) => (body) => saveFilters(paths, body),
    },
    {
      method: "PUT",
      path: "/api/layouts",
      example: "/api/layouts",
      logged: false,
      write: (paths) => (body) => saveLayouts(paths, body),
    },
    {
      method: "PUT",
      path: "/api/config",
      example: "/api/config",
      logged: false,
      write: (paths) => (body) => saveConfig(paths, body),
    },
    {
      method: "POST",
      path: "/api/tags",
      example: "/api/tags",
      logged: true,
      write: (paths) => (body) => createTag(paths, body),
    },
    {
      method: "POST",
      path: "/api/versions",
      example: "/api/versions",
      logged: false,
      write: (paths) => (body) => saveVersion(paths, body),
    },
  ];
}

export interface WorkbenchServer {
  routes: readonly RouteRow[];
  offlineStatus: (dir: string) => Promise<OfflineStatus>;
  cube: () => CubeFolder;
  open: (dir: string) => Promise<CubeFolder>;
  watched: () => readonly string[];
  isCubeFile: (path: string) => boolean;
}

async function answer<T>(
  work: Promise<T>,
  ok: (value: T) => Response,
  failed: (error: unknown) => number = () => 500,
): Promise<Response> {
  try {
    return ok(await work);
  } catch (error) {
    return json(failed(error), { error: errorText(error) });
  }
}

function scryfallFailure(error: unknown): number {
  if (isUnreachable(error)) {
    return 503;
  }
  return error instanceof ScryfallError ? scryfallStatus(error.status) : 502;
}

function explained<T>(work: Promise<T>, what: string): Promise<T> {
  return work.catch((error: unknown) => {
    const text = unreachableText(error, what);
    if (text === undefined) {
      throw error;
    }
    throw new TypeError(text, { cause: error });
  });
}

interface OpenCube {
  folder: CubeFolder;
  paths: CubePaths;
  cubeRoot: string;
}

export async function createWorkbenchServer(options: WorkbenchOptions): Promise<WorkbenchServer> {
  const reachability = new Reachability(options.fetch ?? fetch, USER_AGENT);
  const client = new ScryfallClient({
    userAgent: USER_AGENT,
    cache: new FileCache(options.cacheDir),
    fetch: reachability.fetch,
  });
  const oracleTags = new OracleTagStore({
    client,
    file: join(options.cacheDir, "oracle-tags.json"),
  });
  const images = new ImageCache(options.imageCacheDir, USER_AGENT, reachability.fetch);
  const offlineDeps: OfflineDeps = { client, oracleTags, images };
  const runs = new OfflineRuns();
  const stats = statsOf(client);
  const importDeps: ImportDeps = {
    client,
    oracleTags,
    userAgent: USER_AGENT,
    fetch: reachability.fetch,
  };
  const remembered = new Map<string, Card[]>();
  let writes: Promise<unknown> = Promise.resolve();

  async function load(dir: string): Promise<OpenCube> {
    const folder = await openCubeFolder(dir);
    return {
      folder,
      paths: folder.paths,
      cubeRoot: resolve(folder.dir) + sep,
    };
  }

  let current = await load(options.cubeDir);

  async function open(dir: string): Promise<CubeFolder> {
    const switched = writes.then(async () => {
      current = await load(dir);
    });
    writes = switched.catch(() => undefined);
    await switched;
    return current.folder;
  }

  async function runWrite(paths: CubePaths, request: Request, matched: Route): Promise<Response> {
    const body = parseJson(await request.text());
    if (!body.ok) {
      return json(400, { error: "Body is not valid JSON" });
    }
    const message = logMessage(request);
    const before = matched.logged ? await readLogState(paths) : undefined;
    const result = await explained(matched.write(body.value), "that needs a connection");
    if (!result.ok) {
      return json(result.status, { error: result.error });
    }
    if ("config" in result && current.paths === paths) {
      current = { ...current, folder: { ...current.folder, config: result.config } };
    }
    if (before !== undefined) {
      await recordEdit(paths, before, stats, { message }).catch((error: unknown) => {
        console.warn(`Could not log the edit: ${String(error)}`);
      });
    }
    const kept = await keepPrintings(chosenPrintings(body.value), client, remembered).catch(
      () => [],
    );
    warmImages(kept, images);
    return json(200, written(result));
  }

  const get = (
    path: string | RegExp,
    example: string,
    handle: (context: RouteContext) => Promise<Response>,
  ): RouteRow => ({ method: "GET", path, example, handle });

  const writeRow = (row: WriteRow): RouteRow => ({
    method: row.method,
    path: row.path,
    example: row.example,
    handle: async ({ request, params }) => {
      const { paths } = current;
      const sentFor = request.headers.get(CUBE_HEADER);
      if (sentFor !== null && sentFor !== current.folder.config.id) {
        return json(409, {
          error: `This edit was for another cube; ${current.folder.config.name} is open now`,
        });
      }
      const matched: Route = {
        write: row.write(paths, params, logMessage(request)),
        logged: row.logged,
      };
      const run = writes.then(() => runWrite(paths, request, matched));
      writes = run.catch(() => undefined);
      return run.catch((error: unknown) =>
        json(isUnreachable(error) ? 503 : 500, { error: errorText(error) }),
      );
    },
  });

  const routes: RouteRow[] = [
    get(
      IMAGE_ROUTE,
      `${IMAGE_ROUTE}?u=https%3A%2F%2Fcards.scryfall.io%2Fsmall%2Ffront%2Fx.jpg`,
      async ({ url }) => {
        const remote = url.searchParams.get("u") ?? "";
        if (!isAllowedImage(remote)) {
          return json(400, { error: "Only Scryfall card images are served" });
        }
        return answer(
          images.get(remote),
          (image) =>
            new Response(new Uint8Array(image.body), {
              status: 200,
              headers: {
                "Content-Type": image.type,
                "Cache-Control": "public, max-age=31536000, immutable",
              },
            }),
          () => 502,
        );
      },
    ),
    {
      method: "POST",
      path: "/api/import/preview",
      example: "/api/import/preview",
      handle: async ({ request }) => {
        const body = parseJson(await request.text());
        if (!body.ok) {
          return json(400, { error: "Body is not valid JSON" });
        }
        return answer(
          explained(
            previewImport(current.paths, body.value, importDeps),
            "importing needs a connection",
          ),
          (result) =>
            result.ok ? json(200, result.preview) : json(result.status, { error: result.error }),
          scryfallFailure,
        );
      },
    },
    get("/api/export", "/api/export?format=csv", ({ url }) =>
      answer(
        explained(
          exportCube(current.paths, client, url.searchParams.get("format") ?? ""),
          "export needs a connection",
        ),
        (result) =>
          result.ok
            ? new Response(result.text, {
                status: 200,
                headers: {
                  "Content-Type": "text/plain; charset=utf-8",
                  "Content-Disposition": `attachment; filename="${result.filename}"`,
                  "X-Export-Losses": result.losses.join(","),
                },
              })
            : json(result.status, { error: result.error }),
        scryfallFailure,
      ),
    ),
    {
      method: "POST",
      path: "/api/offline",
      example: "/api/offline",
      handle: () => {
        runs.start(current.folder.config.id, current.paths, offlineDeps);
        return answer(offlineStatus(current.folder.dir), (status) => json(202, status));
      },
    },
    get("/api/connection", "/api/connection", () =>
      answer(reachability.online(), (online) => json(200, { online })),
    ),
    get("/api/offline", "/api/offline", () =>
      answer(offlineStatus(current.folder.dir), (status) => json(200, status)),
    ),
    get("/api/search", "/api/search?q=bolt", ({ url }) =>
      answer(
        explained(search(current.paths, client, url.searchParams.get("q") ?? ""), "search is off"),
        (results) => json(200, results),
        scryfallFailure,
      ),
    ),
    get("/api/versions", "/api/versions", () =>
      answer(listVersions(current.paths), (versions) => json(200, versions)),
    ),
    get("/api/versions/compare", "/api/versions/compare", ({ url }) =>
      answer(
        compareVersions(
          current.paths,
          url.searchParams.get("from") ?? CURRENT,
          url.searchParams.get("to") ?? CURRENT,
        ),
        (result) =>
          result.ok ? json(200, result.diff) : json(result.status, { error: result.error }),
      ),
    ),
    get("/api/config", "/api/config", () =>
      answer(readConfig(current.paths), (config) => json(200, config)),
    ),
    get("/api/layouts", "/api/layouts", () =>
      answer(loadLayouts(current.paths), (layouts) => json(200, layouts)),
    ),
    get("/api/filters", "/api/filters", () =>
      answer(loadFilters(current.paths), (filters) => json(200, filters)),
    ),
    get("/api/board", "/api/board", () =>
      answer(loadBoard(current.paths), (board) => json(200, board)),
    ),
    get(PRINTINGS_ROUTE, "/api/cards/shock/printings", ({ params }) => {
      const slug = params[0] ?? "";
      return answer(
        explained(
          listPrintings(current.paths, client, slug, remembered),
          "printings need a connection",
        ),
        (printings) =>
          printings === undefined
            ? json(404, { error: `No card "${slug}"` })
            : json(200, printings),
        scryfallFailure,
      );
    }),
    get("/api/cube", "/api/cube", () =>
      answer(
        explained(
          loadWorkbench(current.paths, client),
          "some cards aren't saved for offline use. Make the cube available offline once you're back online",
        ),
        (data) => json(200, data),
        (error) => (isUnreachable(error) ? 503 : 500),
      ),
    ),
    get("/api/log", "/api/log", () =>
      answer(readLog(current.paths), (entries) => json(200, entries)),
    ),
    ...writeRows(client, oracleTags, stats, importDeps).map(writeRow),
  ];

  async function offlineStatus(dir: string): Promise<OfflineStatus> {
    const folder = dir === current.folder.dir ? current.folder : await openCubeFolder(dir);
    const run = runs.get(folder.config.id);
    const status = await cacheStatus(folder.paths, offlineDeps);
    return run === undefined ? status : { ...status, run };
  }

  return {
    routes,
    offlineStatus,
    cube: () => current.folder,
    open,
    watched: () => [current.paths.root],
    isCubeFile: (file) => {
      const path = resolve(file);
      return !path.endsWith(".tmp") && path.startsWith(current.cubeRoot);
    },
  };
}
