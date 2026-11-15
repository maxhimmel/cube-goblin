import type {
  BoardStatuses,
  CardEntry,
  CubePaths,
  ImportMatch,
  ImportPlan,
  ImportPreview,
  ImportRequest,
  ImportRow,
  ImportSource,
  Tag,
} from "@repo/cube";
import {
  applyImport,
  cubeCobraId,
  exportFormat,
  fetchCubeCobra,
  formatLosses,
  importRequestSchema,
  parseList,
  planImport,
  readCards,
  readConfig,
  readTags,
  resolveRows,
  statusForBoard,
  toExportCards,
} from "@repo/cube";
import type { Card, ScryfallClient } from "@repo/scryfall";
import { ScryfallError } from "@repo/scryfall";

export interface ImportDeps {
  client: ScryfallClient;
  userAgent: string;
  fetch?: typeof fetch;
}

export interface SourceText {
  text: string;
  batch: string;
}

export async function readImportSource(
  source: ImportSource,
  deps: Omit<ImportDeps, "client">,
): Promise<SourceText> {
  if ("text" in source) {
    return { text: source.text, batch: "import" };
  }
  const id = cubeCobraId(source.url);
  if (id === undefined) {
    throw new RangeError(`"${source.url}" isn't a Cube Cobra cube link or id`);
  }
  const text = await fetchCubeCobra(id, {
    userAgent: deps.userAgent,
    ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
  });
  return { text, batch: `cubecobra-${id}` };
}

export interface PrepareOptions {
  existing: readonly CardEntry[];
  tags: readonly Tag[];
  boards: BoardStatuses;
  edits: Readonly<Record<string, string>>;
}

export interface PreparedImport {
  plan: ImportPlan;
  preview: ImportPreview;
}

function edited(rows: readonly ImportRow[], edits: Readonly<Record<string, string>>): ImportRow[] {
  return rows.flatMap((row) => {
    const name = edits[String(row.line)];
    if (name === undefined) {
      return [row];
    }
    const trimmed = name.trim();
    if (trimmed === "") {
      return [];
    }
    const { line: at, input, quantity, board, tags, notes } = row;
    return [{ line: at, input, name: trimmed, quantity, board, tags, notes }];
  });
}

function line(row: ImportRow): { line: number; input: string; name: string } {
  return { line: row.line, input: row.input.trim(), name: row.name };
}

export async function prepareImport(
  client: ScryfallClient,
  source: SourceText,
  options: PrepareOptions,
): Promise<PreparedImport> {
  const parsed = parseList(source.text);
  const rows = edited(parsed.rows, options.edits);
  const { matches, misses } = await resolveRows<ImportRow, Card>(rows, {
    collection: (identifiers) => client.collection(identifiers),
    fuzzy: (name) =>
      client.named(name, { fuzzy: true }).catch((error: unknown) => {
        if (error instanceof ScryfallError && error.status === 404) {
          return undefined;
        }
        throw error;
      }),
  });
  const importMatches: ImportMatch[] = matches.flatMap(({ row, card, how }) => {
    if (card.oracle_id === undefined) {
      return [];
    }
    const pinned = how === "printing" || how === "mtgo" || how === "set-number";
    return [
      { row, oracleId: card.oracle_id, name: card.name, ...(pinned ? { printing: card.id } : {}) },
    ];
  });
  const plan = planImport({
    matches: importMatches,
    existing: options.existing,
    tags: options.tags,
    batch: source.batch,
    boards: options.boards,
  });
  const how = new Map(matches.map((match) => [match.row, match.how]));
  const labels = new Map([...options.tags, ...plan.newTags].map((tag) => [tag.id, tag.label]));
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.board, (counts.get(row.board) ?? 0) + 1);
  }
  const byLine = new Map(rows.map((row) => [row.line, row]));
  const preview: ImportPreview = {
    format: parsed.format,
    ...(parsed.title === undefined ? {} : { title: parsed.title }),
    boards: [...counts].map(([board, count]) => ({
      board,
      count,
      status: statusForBoard(board, options.boards),
    })),
    added: plan.cards.flatMap((card) => {
      const row = byLine.get(card.source.line);
      if (row === undefined) {
        return [];
      }
      return [
        {
          ...line(row),
          card: card.name,
          status: card.status,
          tags: card.tags.map((id) => labels.get(id) ?? id),
          how: how.get(row) ?? "name",
        },
      ];
    }),
    misses: misses.map(({ row, reason }) => ({ ...line(row), reason })),
    skipped: plan.skipped.map(({ row, reason }) => ({ ...line(row), reason })),
    warnings: plan.warnings.map(({ row, message }) => ({ ...line(row), message })),
    newTags: plan.newTags.map((tag) => tag.label),
  };
  return { plan, preview };
}

export type ImportResult =
  | { ok: true; imported: { added: number; title?: string } }
  | { ok: false; status: 400 | 404 | 502; error: string };

async function requested(
  paths: CubePaths,
  body: unknown,
  deps: ImportDeps,
  into: "current" | "new" | undefined,
): Promise<
  | { ok: true; prepared: PreparedImport; request: ImportRequest }
  | Extract<ImportResult, { ok: false }>
> {
  const parsed = importRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  const request = parsed.data;
  let source: SourceText;
  try {
    source = await readImportSource(request.source, deps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: error instanceof RangeError ? 400 : 502, error: message };
  }
  const fresh = (into ?? request.into) === "new";
  const [existing, tags] = fresh
    ? [[], []]
    : await Promise.all([readCards(paths), readTags(paths)]);
  const prepared = await prepareImport(deps.client, source, {
    existing,
    tags,
    boards: request.boards,
    edits: request.edits,
  });
  const { added, misses, skipped } = prepared.preview;
  if (added.length + misses.length + skipped.length === 0) {
    return { ok: false, status: 400, error: "No card lines found" };
  }
  return { ok: true, prepared, request };
}

export async function previewImport(
  paths: CubePaths,
  body: unknown,
  deps: ImportDeps,
): Promise<{ ok: true; preview: ImportPreview } | Extract<ImportResult, { ok: false }>> {
  const result = await requested(paths, body, deps, undefined);
  return result.ok ? { ok: true, preview: result.prepared.preview } : result;
}

export async function runImport(
  paths: CubePaths,
  body: unknown,
  deps: ImportDeps,
): Promise<ImportResult> {
  const result = await requested(paths, body, deps, "current");
  if (!result.ok) {
    return result;
  }
  const applied = await applyImport(paths, result.prepared.plan);
  if (!applied.ok) {
    return { ok: false, status: 400, error: applied.error };
  }
  const { title } = result.prepared.preview;
  return {
    ok: true,
    imported: { added: applied.added, ...(title === undefined ? {} : { title }) },
  };
}

export type ExportResult =
  | { ok: true; text: string; filename: string; losses: string[] }
  | { ok: false; status: 400; error: string };

export async function exportCube(
  paths: CubePaths,
  client: ScryfallClient,
  formatId: string,
): Promise<ExportResult> {
  const format = exportFormat(formatId);
  if (format === undefined) {
    return { ok: false, status: 400, error: `No export format "${formatId}"` };
  }
  const [cards, tags, config] = await Promise.all([
    readCards(paths),
    readTags(paths),
    readConfig(paths),
  ]);
  const { cards: printings } = await client.forEntries(cards);
  const text = format.write(
    toExportCards(cards, tags, (entry) => printings.get(entry.oracleId)),
    { name: config.name, size: config.size },
  );
  const base = config.name.replace(/[^\w-]+/gu, "-").replace(/^-|-$/gu, "") || "cube";
  return {
    ok: true,
    text,
    filename: `${base}-${format.id}.${format.extension}`,
    losses: formatLosses(format),
  };
}
