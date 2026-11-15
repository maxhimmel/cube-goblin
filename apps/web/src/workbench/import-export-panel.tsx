import type { BoardChoice, ImportPreview, ImportRequestInput } from "@repo/cube/browser";
import {
  AI_IMPORT_PROMPT,
  CARD_STATUS_LABELS,
  EXPORT_FORMATS,
  formatLosses,
} from "@repo/cube/browser";
import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { setCubeIdentity } from "../cube-identity.ts";
import { queryClient } from "../query-client.ts";
import { useRemembered } from "../view-choices.ts";
import { exportRequest, importRequest, previewImportRequest } from "./api.ts";
import { settled } from "./cube-switcher.tsx";
import { SheetTabs } from "./sheet-tabs.tsx";
import { showToast } from "./toast.tsx";

const TABS = [
  { id: "import", label: "Import" },
  { id: "export", label: "Export" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const SOURCES = [
  { id: "paste", label: "Paste" },
  { id: "file", label: "File" },
  { id: "cubecobra", label: "Cube Cobra" },
] as const;

type SourceKind = (typeof SOURCES)[number]["id"];

const READ_AS: Record<string, string> = {
  "cubecobra-json": "a Cube Cobra cube",
  "cubecobra-csv": "a Cube Cobra CSV",
  cockatrice: "a Cockatrice deck",
  "mtgo-dek": "an MTGO .dek",
  draftmancer: "a Draftmancer list",
  text: "a deck list",
};

const BOARD_LABELS: Record<string, string> = {
  main: "Main deck",
  side: "Sideboard",
  maybe: "Maybeboard",
  cut: "Cut",
  tokens: "Tokens",
};

const CHOICES: readonly { value: BoardChoice; label: string }[] = [
  { value: "draft", label: CARD_STATUS_LABELS.draft },
  { value: "prospect", label: CARD_STATUS_LABELS.prospect },
  { value: "cut", label: CARD_STATUS_LABELS.cut },
  { value: "skip", label: "Skip" },
];

const FILE_TYPES = ".txt,.csv,.dek,.dck,.cod,.json";

export function ImportExportPanel({ onClose }: { onClose: () => void }): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useRemembered<Tab>(
    "import-export.tab",
    "import",
    z.enum(TABS.map((option) => option.id) as [Tab, ...Tab[]]),
  );

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const close = () => {
    dialog.current?.close();
  };

  return (
    <dialog
      ref={dialog}
      className="sheet settings-panel transfer-panel"
      aria-label="Import and export"
      onClose={onClose}
    >
      <header className="sheet-head">
        <h2>Import and export</h2>
        <button type="button" aria-label="Close" onClick={close}>
          ×
        </button>
      </header>
      <div className="settings-body">
        <SheetTabs
          tabs={TABS}
          current={tab}
          label="Import and export"
          idPrefix="transfer"
          onChange={setTab}
        />
        <div
          className="settings-page"
          role="tabpanel"
          id="transfer-page-import"
          aria-labelledby="transfer-tab-import"
          hidden={tab !== "import"}
        >
          <ImportPage onDone={close} />
        </div>
        <div
          className="settings-page"
          role="tabpanel"
          id="transfer-page-export"
          aria-labelledby="transfer-tab-export"
          hidden={tab !== "export"}
        >
          <ExportPage />
        </div>
      </div>
    </dialog>
  );
}

function boardLabel(board: string): string {
  return BOARD_LABELS[board] ?? board;
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? "" : "s"}`;
}

function ImportPage({ onDone }: { onDone: () => void }): ReactNode {
  const [kind, setKind] = useState<SourceKind>("paste");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [url, setUrl] = useState("");
  const [boards, setBoards] = useState<Record<string, BoardChoice>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [into, setInto] = useState<"current" | "new">("current");
  const [newName, setNewName] = useState("");
  const [checked, setChecked] = useState<Record<string, string>>({});
  const cubes = window.desktop?.cubes;

  const source = kind === "cubecobra" ? { url: url.trim() } : { text };
  const ready = kind === "cubecobra" ? url.trim() !== "" : text.trim() !== "";
  const request = (overrides: Partial<ImportRequestInput> = {}): ImportRequestInput => ({
    source,
    boards,
    edits,
    into,
    ...overrides,
  });

  const [result, setResult] = useState<ImportPreview | undefined>(undefined);
  const preview = useMutation({
    mutationFn: previewImportRequest,
    meta: { saves: false },
    onSuccess: (fresh) => {
      setResult(fresh);
      const lines = { ...checked };
      for (const entry of [
        ...fresh.misses,
        ...fresh.added.filter((card) => card.how === "fuzzy"),
      ]) {
        lines[String(entry.line)] ??= entry.name;
      }
      setChecked(lines);
    },
  });
  const previewed = preview.variables;
  const current = JSON.stringify(request());
  const stale = previewed === undefined || JSON.stringify(previewed) !== current;

  const run = (overrides: Partial<ImportRequestInput> = {}) => {
    preview.mutate(request(overrides));
  };

  const commit = useMutation({
    mutationFn: async (result: ImportPreview) => {
      const title = result.title ?? READ_AS[result.format] ?? "import";
      const subject = `Import ${plural(result.added.length, "card")} from ${title}`;
      if (into === "new" && cubes !== undefined) {
        const created = await cubes.create(newName.trim() || title);
        setCubeIdentity(created);
        await importRequest({ ...request(), into: "current" }, { subject });
        window.location.reload();
        return;
      }
      await importRequest(request(), { subject });
      await queryClient.invalidateQueries();
      showToast({ message: `Imported ${plural(result.added.length, "card")}`, tone: "info" });
      onDone();
    },
    onError: (error) => {
      showToast({ message: error.message, tone: "error" });
    },
  });

  const resetPreview = () => {
    setBoards({});
    setEdits({});
    setChecked({});
    setResult(undefined);
    preview.reset();
  };

  return (
    <div className="settings-section transfer-import">
      <div className="segmented" role="group" aria-label="Import from">
        {SOURCES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={kind === option.id}
            onClick={() => {
              setKind(option.id);
              resetPreview();
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {kind === "paste" && (
        <textarea
          aria-label="List to import"
          className="transfer-text"
          rows={8}
          placeholder={
            "Paste a list from Cube Cobra, Draftmancer, MTGO, Arena, Moxfield,\nArchidekt, Cockatrice, or XMage"
          }
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      )}
      {kind === "paste" && <AiHelper />}
      {kind === "file" && (
        <label className="transfer-file">
          <input
            type="file"
            accept={FILE_TYPES}
            aria-label="File to import"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file === undefined) {
                return;
              }
              void file.text().then((content) => {
                setText(content);
                setFileName(file.name);
                resetPreview();
              });
            }}
          />
          <span className="muted">
            {fileName ?? "Any list file: .txt, .csv, .dek, .dck, .cod, .json"}
          </span>
        </label>
      )}
      {kind === "cubecobra" && (
        <input
          aria-label="Cube Cobra link or id"
          className="transfer-url"
          placeholder="https://cubecobra.com/cube/list/…"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
          }}
        />
      )}
      <button
        type="button"
        disabled={!ready || preview.isPending || (result !== undefined && !stale)}
        onClick={() => {
          run();
        }}
      >
        {preview.isPending ? "Reading…" : "Preview"}
      </button>
      {preview.error && (
        <p role="alert" className="error">
          {preview.error.message}
        </p>
      )}
      {result && (
        <ImportReview
          result={result}
          boards={boards}
          edits={edits}
          checked={checked}
          stale={stale}
          busy={preview.isPending}
          onBoard={(board, choice) => {
            const next = { ...boards, [board]: choice };
            setBoards(next);
            run({ boards: next });
          }}
          onEdit={(line, name) => {
            const key = String(line);
            const rest = Object.fromEntries(Object.entries(edits).filter(([line]) => line !== key));
            setEdits(name === checked[key] ? rest : { ...rest, [key]: name });
          }}
          onCheck={() => {
            run();
          }}
        />
      )}
      {result && cubes !== undefined && (
        <fieldset className="settings-choice">
          <legend>Import into</legend>
          <label className="settings-check">
            <input
              type="radio"
              name="import-into"
              checked={into === "current"}
              onChange={() => {
                setInto("current");
                run({ into: "current" });
              }}
            />
            This cube
          </label>
          <label className="settings-check">
            <input
              type="radio"
              name="import-into"
              checked={into === "new"}
              onChange={() => {
                setInto("new");
                setNewName(newName === "" ? (result.title ?? "") : newName);
                run({ into: "new" });
              }}
            />
            A new cube
          </label>
          {into === "new" && (
            <input
              aria-label="New cube name"
              placeholder="New cube name"
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
              }}
            />
          )}
        </fieldset>
      )}
      {result && (
        <button
          type="button"

          disabled={
            stale ||
            result.added.length === 0 ||
            commit.isPending ||
            (into === "new" && newName.trim() === "")
          }
          title={stale ? "Check the list again first" : undefined}
          onClick={() => {
            void settled().then(() => {
              commit.mutate(result);
            });
          }}
        >
          {commit.isPending ? "Importing…" : `Import ${plural(result.added.length, "card")}`}
        </button>
      )}
    </div>
  );
}

function ImportReview({
  result,
  boards,
  edits,
  checked,
  stale,
  busy,
  onBoard,
  onEdit,
  onCheck,
}: {
  result: ImportPreview;
  boards: Record<string, BoardChoice>;
  edits: Record<string, string>;
  checked: Record<string, string>;
  stale: boolean;
  busy: boolean;
  onBoard: (board: string, choice: BoardChoice) => void;
  onEdit: (line: number, name: string) => void;
  onCheck: () => void;
}): ReactNode {
  const counts = { draft: 0, prospect: 0, cut: 0 };
  for (const card of result.added) {
    counts[card.status] += 1;
  }
  const missed = new Set(result.misses.map((miss) => miss.line));
  const added = new Map(result.added.map((card) => [card.line, card]));
  const note = (line: number): string => {
    if (edits[String(line)] === "") {
      return "skipped";
    }
    if (missed.has(line)) {
      return "not found";
    }
    const card = added.get(line);
    if (card === undefined) {
      return "";
    }
    return card.how === "fuzzy" ? `guessed ${card.card}` : `found ${card.card}`;
  };
  const fixes = Object.entries(checked)
    .map(([line, name]) => ({ line: Number(line), name, note: note(Number(line)) }))
    .toSorted((a, b) => a.line - b.line);
  return (
    <div className="transfer-review" aria-busy={busy}>
      <p className="muted">
        Read as {READ_AS[result.format] ?? result.format}
        {result.title === undefined ? "" : `: ${result.title}`}
      </p>
      <table className="transfer-boards">
        <caption className="eyebrow">Boards</caption>
        <tbody>
          {result.boards.map(({ board, count, status }) => (
            <tr key={board}>
              <th scope="row">{boardLabel(board)}</th>
              <td className="muted">{plural(count, "line")}</td>
              <td>
                <select
                  aria-label={`${boardLabel(board)} becomes`}
                  value={boards[board] ?? status}
                  onChange={(event) => {
                    onBoard(board, event.target.value as BoardChoice);
                  }}
                >
                  {CHOICES.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="transfer-summary">
        Adds {plural(result.added.length, "card")}: {String(counts.draft)} draft,{" "}
        {String(counts.prospect)} prospect, {String(counts.cut)} cut.
        {result.newTags.length > 0 && ` New tags: ${result.newTags.join(", ")}.`}
      </p>
      {fixes.length > 0 && (
        <section className="transfer-fixes" aria-label="Lines to check">
          <h3 className="eyebrow">Check {plural(fixes.length, "line")}</h3>
          <ul>
            {fixes.map((fix) => {
              const value = edits[String(fix.line)];
              const skipped = value === "";
              return (
                <li key={fix.line} data-skipped={skipped}>
                  <span className="muted">Line {String(fix.line)}</span>
                  <input
                    aria-label={`Card name on line ${String(fix.line)}`}
                    value={skipped ? fix.name : (value ?? fix.name)}
                    disabled={skipped}
                    onChange={(event) => {
                      onEdit(fix.line, event.target.value);
                    }}
                  />
                  <span className="muted">{fix.note}</span>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      onEdit(fix.line, skipped ? fix.name : "");
                    }}
                  >
                    {skipped ? "Keep" : "Skip"}
                  </button>
                </li>
              );
            })}
          </ul>
          {stale && (
            <button type="button" disabled={busy} onClick={onCheck}>
              Check again
            </button>
          )}
        </section>
      )}
      {result.warnings.length > 0 && (
        <details>
          <summary>{plural(result.warnings.length, "warning")}</summary>
          <ul>
            {result.warnings.map((warning) => (
              <li key={warning.line}>{warning.message}</li>
            ))}
          </ul>
        </details>
      )}
      {result.skipped.length > 0 && (
        <details>
          <summary>{plural(result.skipped.length, "line")} skipped</summary>
          <ul>
            {result.skipped.map((skip) => (
              <li key={skip.line}>
                {skip.name}: {skip.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
      {result.added.length > 0 && (
        <details>
          <summary>Cards to add</summary>
          <ul className="transfer-added">
            {result.added.map((card) => (
              <li key={card.line}>
                {card.card} <span className="muted">{CARD_STATUS_LABELS[card.status]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function download({ blob, filename }: { blob: Blob; filename: string }): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

function ExportPage(): ReactNode {
  const [format, setFormat] = useRemembered<string>(
    "import-export.format",
    EXPORT_FORMATS[0]?.id ?? "",
    z.string(),
  );
  const save = useMutation({
    mutationFn: exportRequest,
    meta: { saves: false },
    onSuccess: download,
    onError: (error) => {
      showToast({ message: error.message, tone: "error" });
    },
  });
  return (
    <div className="settings-section">
      <fieldset className="settings-choice transfer-formats">
        <legend>Format</legend>
        {EXPORT_FORMATS.map((option) => {
          const losses = formatLosses(option);
          return (
            <label key={option.id} className="settings-check">
              <input
                type="radio"
                name="export-format"
                checked={format === option.id}
                onChange={() => {
                  setFormat(option.id);
                }}
              />
              <span>{option.label}</span>
              <span className="muted">
                {losses.length === 0 ? "keeps everything" : `drops ${losses.join(", ")}`}
              </span>
            </label>
          );
        })}
      </fieldset>
      <button
        type="button"

        disabled={save.isPending}
        onClick={() => {
          save.mutate(format);
        }}
      >
        {save.isPending ? "Exporting…" : "Download"}
      </button>
    </div>
  );
}

function AiHelper(): ReactNode {
  return (
    <details className="transfer-ai">
      <summary>Your own format? Let an AI convert it</summary>
      <ol>
        <li>
          Copy this prompt.{" "}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              void navigator.clipboard.writeText(AI_IMPORT_PROMPT).then(
                () => {
                  showToast({ message: "Prompt copied", tone: "info" });
                },
                () => {
                  showToast({
                    message: "Couldn't copy; select the prompt and copy it",
                    tone: "error",
                  });
                },
              );
            }}
          >
            Copy prompt
          </button>
        </li>
        <li>
          Paste it into an AI chat (ChatGPT, Claude, Gemini, or any other), then paste your list
          right after it and send.
        </li>
        <li>Copy the AI's answer, paste it in the Paste box above, and press Preview.</li>
      </ol>
      <textarea
        aria-label="Prompt for an AI"
        className="transfer-text"
        readOnly
        rows={6}
        value={AI_IMPORT_PROMPT}
        onFocus={(event) => {
          event.target.select();
        }}
      />
    </details>
  );
}
