import { COMPARE_UNITS, cardOverlap, unmatchedTagCounts } from "@repo/cube/browser";
import type { CompareUnit } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { Menu } from "../menu.tsx";
import type { GridCard } from "../modes/mode.ts";
import type { Against, Compare } from "./compare.ts";
import { Segmented } from "./toolbar.tsx";

const UNIT_LABEL: Record<CompareUnit, string> = {
  share: "Scaled",
  count: "Counts",
};

function NameList({ title, cards }: { title: string; cards: readonly GridCard[] }): ReactNode {
  return (
    <details className="lab-shared-list">
      <summary>
        {title} <span className="muted">{cards.length}</span>
      </summary>
      {cards.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <ul>
          {cards.map((card) => (
            <li key={card.oracleId}>{card.name}</li>
          ))}
        </ul>
      )}
    </details>
  );
}

export function SharedCards({
  scope,
  against,
}: {
  scope: readonly GridCard[];
  against: Against;
}): ReactNode {
  const overlap = cardOverlap(scope, against.cards);
  return (
    <div className="lab-shared" aria-label={`Cards shared with ${against.name}`}>
      <NameList title="In both" cards={overlap.shared} />
      <NameList title="Only here" cards={overlap.onlyHere} />
      <NameList title={`Only in ${against.name}`} cards={overlap.onlyThere} />
    </div>
  );
}

export function UnmatchedTags({ against }: { against: Against }): ReactNode {
  const unmatched = unmatchedTagCounts(against.cards, against.match);
  if (unmatched.length === 0) {
    return null;
  }
  return (
    <details className="lab-unmatched">
      <summary>
        Only in {against.name} <span className="muted">{unmatched.length} tags</span>
      </summary>
      <ul aria-label={`Tags only in ${against.name}`}>
        {unmatched.map(({ tag, count }) => (
          <li key={tag.id}>
            {tag.label} <span className="muted">{count}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function statusText(compare: Compare): string | undefined {
  const { status } = compare;
  if (status.kind === "loading") {
    return `Loading ${status.name}…`;
  }
  if (status.kind === "failed") {
    return `Couldn't load ${status.name}: ${status.error}`;
  }
  return undefined;
}

export function CompareMenu({ compare }: { compare: Compare }): ReactNode {
  const { cubes, choice, setChoice, status } = compare;
  if (cubes === undefined) {
    return null;
  }
  const label = status.kind === "off" ? "Compare" : `vs ${status.name}`;
  const note = statusText(compare);
  return (
    <Menu label={label} listLabel="Compare with another cube">
      {cubes.length === 0 ? (
        <span className="muted">Open or import another cube to compare with it</span>
      ) : (
        <div className="lab-compare-cubes" role="radiogroup" aria-label="Compare with">
          <label>
            <input
              type="radio"
              name="compare-cube"
              checked={status.kind === "off"}
              onChange={() => {
                setChoice({ ...choice, dir: null });
              }}
            />
            None
          </label>
          {cubes.map((cube) => (
            <label key={cube.dir}>
              <input
                type="radio"
                name="compare-cube"
                checked={choice.dir === cube.dir && status.kind !== "off"}
                onChange={() => {
                  setChoice({ ...choice, dir: cube.dir });
                }}
              />
              {cube.name}
            </label>
          ))}
        </div>
      )}
      {note !== undefined && (
        <p className="muted" role="status">
          {note}
        </p>
      )}
      <p className="muted lab-compare-hint">
        Each block compares the same cards on both sides: its scope menu picks them.
      </p>
      <p className="muted lab-compare-hint">
        {choice.unit === "share" ? "Their numbers, scaled to this cube's size" : "Their raw counts"}
      </p>
      <Segmented
        label="Numbers"
        options={COMPARE_UNITS.map((id) => ({ id, label: UNIT_LABEL[id] }))}
        value={choice.unit}
        onChange={(unit) => {
          setChoice({ ...choice, unit });
        }}
      />
    </Menu>
  );
}
