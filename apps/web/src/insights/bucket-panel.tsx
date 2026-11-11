import type { Bucket } from "@repo/cube/browser";
import { inBucket } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useState } from "react";
import type { GridCard } from "../modes/mode.ts";
import type { Hover } from "../strip.tsx";
import { Preview, Strip } from "../strip.tsx";

function byCostThenName(a: GridCard, b: GridCard): number {
  return a.cmc - b.cmc || a.name.localeCompare(b.name);
}

export function BucketPanel({
  bucket,
  title,
  label,
  cards,
  onClose,
  onSave,
}: {
  bucket: Bucket;
  title: string;
  label: string;
  cards: readonly GridCard[];
  onClose: () => void;
  onSave?: (() => void) | undefined;
}): ReactNode {
  const [hover, setHover] = useState<Hover | undefined>(undefined);
  const listed = cards.filter((card) => inBucket(card, bucket)).sort(byCostThenName);
  return (
    <aside className="bucket-panel" aria-label="Cards in bucket">
      <header className="bucket-head">
        <div>
          <p className="muted bucket-chart">{title}</p>
          <h2>
            {label} <span className="muted">{listed.length}</span>
          </h2>
        </div>
        {onSave && (
          <button type="button" className="toolbar-link bucket-save" onClick={onSave}>
            Save as filter
          </button>
        )}
        <button
          type="button"
          className="bucket-close"
          aria-label="Close card list"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      {listed.length === 0 ? (
        <p className="muted">No cards here.</p>
      ) : (
        <ul className="bucket-list">
          {listed.map((card) => (
            <Strip key={card.slug} card={card} onHover={setHover} />
          ))}
        </ul>
      )}
      <Preview hover={hover} />
    </aside>
  );
}
