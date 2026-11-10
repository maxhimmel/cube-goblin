import type { CardPatch, Printing, WorkbenchCard } from "@repo/cube/browser";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { fetchPrintings } from "./api.ts";

type Save = (label: string, patch: CardPatch, undo: CardPatch) => void;

function matches(printing: Printing, wanted: string): boolean {
  if (wanted === "") {
    return true;
  }
  return [printing.setName, printing.set, printing.artist, ...printing.labels].some((text) =>
    text.toLowerCase().includes(wanted),
  );
}

const RETRIES = 2;
const RETRY_MS = 1500;

function Thumbnail({ src }: { src: string }): ReactNode {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  return (
    <span className="printing-thumb" data-state={state}>
      <img
        key={attempt}
        src={src}
        alt=""
        loading="lazy"
        width={146}
        height={204}
        onLoad={() => {
          setState("loaded");
        }}
        onError={() => {
          if (attempt < RETRIES) {
            timer.current = setTimeout(() => {
              setAttempt(attempt + 1);
            }, RETRY_MS);
          } else {
            setState("failed");
          }
        }}
      />
      {state !== "loaded" && (
        <span className="printing-thumb-note">
          {state === "loading" ? "loading…" : "image unavailable"}
        </span>
      )}
    </span>
  );
}

function PrintingTile({
  printing,
  chosen,
  current,
  onChoose,
}: {
  printing: Printing;
  chosen: boolean;
  current: boolean;
  onChoose: () => void;
}): ReactNode {
  const year = printing.releasedAt.slice(0, 4);
  return (
    <li>
      <button type="button" className="printing" aria-pressed={chosen} onClick={onChoose}>
        <Thumbnail src={printing.image} />
        <span className="printing-set">
          {printing.setName} <span className="muted">#{printing.collectorNumber}</span>
        </span>
        <span className="printing-meta muted">
          {year}
          {printing.artist && ` · ${printing.artist}`}
        </span>
        {(current || printing.labels.length > 0) && (
          <span className="printing-labels">
            {current && <span className="chip printing-current">showing now</span>}
            {printing.labels.map((label) => (
              <span key={label} className="chip">
                {label}
              </span>
            ))}
          </span>
        )}
      </button>
    </li>
  );
}

function PrintingBrowser({
  card,
  save,
  onClose,
}: {
  card: WorkbenchCard;
  save: Save;
  onClose: () => void;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState("");
  const { data, error, isPending } = useQuery({
    queryKey: ["printings", card.slug],
    queryFn: () => fetchPrintings(card.slug),
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const choose = (printing: string | null): void => {
    if (printing !== (card.printing ?? null)) {
      save("printing", { printing }, { printing: card.printing ?? null });
    }
    dialog.current?.close();
  };

  const wanted = filter.trim().toLowerCase();
  const shown = (data ?? []).filter((printing) => matches(printing, wanted));

  return (
    <dialog
      ref={dialog}
      className="printings"
      aria-label={`Printings of ${card.name}`}
      onClose={onClose}
    >
      <header className="printings-head">
        <h2>Printings of {card.name}</h2>
        <input
          type="search"
          aria-label="Filter printings"
          placeholder="Set, artist, or style (borderless, showcase…)"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
          }}
        />
        <span className="muted" data-testid="printing-count">
          {data ? `${String(shown.length)} of ${String(data.length)}` : ""}
        </span>
        <button
          type="button"
          aria-label="Close printings"
          onClick={() => {
            dialog.current?.close();
          }}
        >
          ×
        </button>
      </header>
      {isPending && <p className="muted">Loading printings from Scryfall…</p>}
      {error && (
        <p role="alert" className="error">
          {error.message}
        </p>
      )}
      {data && (
        <ul className="printings-grid">
          <li>
            <button
              type="button"
              className="printing printing-default"
              aria-pressed={card.printing === undefined}
              onClick={() => {
                choose(null);
              }}
            >
              <span className="printing-set">Default</span>
              <span className="printing-meta muted">Scryfall&apos;s usual printing</span>
            </button>
          </li>
          {shown.map((printing) => (
            <PrintingTile
              key={printing.id}
              printing={printing}
              chosen={card.printing === printing.id}
              current={card.shown.id === printing.id}
              onChoose={() => {
                choose(printing.id);
              }}
            />
          ))}
        </ul>
      )}
    </dialog>
  );
}

export function PrintingCaption({ card, save }: { card: WorkbenchCard; save: Save }): ReactNode {
  const [open, setOpen] = useState(false);
  const unavailable = card.printing !== undefined && card.printing !== card.shown.id;
  return (
    <>
      <p className="printing-caption">
        <span data-testid="shown-printing">
          {card.shown.setName} #{card.shown.collectorNumber}
        </span>
        {unavailable && (
          <span className="printing-warning" role="note">
            {" "}
            (chosen printing unavailable)
          </span>
        )}
        {" · "}
        <button
          type="button"
          className="link-button"
          aria-label="Change printing…"
          onClick={() => {
            setOpen(true);
          }}
        >
          change
        </button>
      </p>
      {open && (
        <PrintingBrowser
          card={card}
          save={save}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
