import type { CardDiff, CubeDiff, SectionDiff, Tag, Workbench } from "@repo/cube/browser";
import { CARD_STATUSES, CARD_STATUS_LABELS, tagLabel } from "@repo/cube/browser";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CardLink } from "../card-pane.tsx";
import { VERSIONS_QUERY_KEY, compareRequest } from "./api.ts";

function CardName({
  card,
  live,
}: {
  card: Pick<CardDiff, "slug" | "name">;
  live: ReadonlySet<string>;
}): ReactNode {
  return live.has(card.slug) ? <CardLink slug={card.slug}>{card.name}</CardLink> : card.name;
}

function TagChanges({
  added,
  removed,
  vocabulary,
}: {
  added: readonly string[];
  removed: readonly string[];
  vocabulary: readonly Tag[];
}): ReactNode {
  return (
    <>
      {added.map((id) => (
        <span key={`+${id}`} className="diff-chip" data-change="added">
          + {tagLabel(id, vocabulary)}
        </span>
      ))}
      {removed.map((id) => (
        <span key={`-${id}`} className="diff-chip" data-change="removed">
          − {tagLabel(id, vocabulary)}
        </span>
      ))}
    </>
  );
}

function DiffGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="diff-group" aria-label={title}>
      <h3>
        {title} <span className="muted">{count}</span>
      </h3>
      {children}
    </section>
  );
}

function statusMove(card: CardDiff): string {
  const from = card.before === undefined ? "Not in cube" : CARD_STATUS_LABELS[card.before];
  const to = card.after === undefined ? "Not in cube" : CARD_STATUS_LABELS[card.after];
  return `${from} → ${to}`;
}

function CardGroups({
  diff,
  vocabulary,
  live,
}: {
  diff: CubeDiff;
  vocabulary: readonly Tag[];
  live: ReadonlySet<string>;
}) {
  const moved = diff.cards.filter(
    (card) => card.before !== undefined && card.after !== undefined && card.before !== card.after,
  );
  const added = diff.cards.filter((card) => card.before === undefined);
  const removed = diff.cards.filter((card) => card.after === undefined);
  const edited = diff.cards.filter(
    (card) =>
      card.before !== undefined &&
      card.after !== undefined &&
      (card.renamedFrom !== undefined ||
        card.tagsAdded.length + card.tagsRemoved.length > 0 ||
        card.notesChanged ||
        card.printingChanged),
  );
  const moves = new Map<string, CardDiff[]>();
  for (const card of moved) {
    const key = statusMove(card);
    moves.set(key, [...(moves.get(key) ?? []), card]);
  }
  return (
    <>
      {added.length > 0 && (
        <DiffGroup title="Added" count={added.length}>
          <ul className="diff-cards">
            {added.map((card) => (
              <li key={card.slug}>
                <CardName card={card} live={live} />
                {card.after && <span className="muted"> as {CARD_STATUS_LABELS[card.after]}</span>}
              </li>
            ))}
          </ul>
        </DiffGroup>
      )}
      {[...moves.entries()].map(([move, cards]) => (
        <DiffGroup key={move} title={move} count={cards.length}>
          <ul className="diff-cards">
            {cards.map((card) => (
              <li key={card.slug}>
                <CardName card={card} live={live} />
              </li>
            ))}
          </ul>
        </DiffGroup>
      ))}
      {removed.length > 0 && (
        <DiffGroup title="Gone" count={removed.length}>
          <ul className="diff-cards">
            {removed.map((card) => (
              <li key={card.slug}>
                <CardName card={card} live={live} />
              </li>
            ))}
          </ul>
        </DiffGroup>
      )}
      {edited.length > 0 && (
        <DiffGroup title="Edited" count={edited.length}>
          <ul className="diff-cards">
            {edited.map((card) => (
              <li key={card.slug}>
                <CardName card={card} live={live} />
                <TagChanges
                  added={card.tagsAdded}
                  removed={card.tagsRemoved}
                  vocabulary={vocabulary}
                />
                {card.renamedFrom !== undefined && (
                  <span className="diff-chip">was {card.renamedFrom}</span>
                )}
                {card.notesChanged && <span className="diff-chip">notes edited</span>}
                {card.printingChanged && <span className="diff-chip">printing changed</span>}
              </li>
            ))}
          </ul>
        </DiffGroup>
      )}
    </>
  );
}

function TagGroup({ tags }: { tags: CubeDiff["tags"] }): ReactNode {
  const count = tags.added.length + tags.removed.length + tags.changed.length;
  if (count === 0) {
    return null;
  }
  return (
    <DiffGroup title="Tag list" count={count}>
      <ul className="diff-cards">
        {tags.added.map((tag) => (
          <li key={tag.id}>
            <span className="diff-chip" data-change="added">
              + {tag.label}
            </span>
          </li>
        ))}
        {tags.removed.map((tag) => (
          <li key={tag.id}>
            <span className="diff-chip" data-change="removed">
              − {tag.label}
            </span>
          </li>
        ))}
        {tags.changed.map(({ before, after }) => (
          <li key={after.id}>
            {before.label} → {after.label}
          </li>
        ))}
      </ul>
    </DiffGroup>
  );
}

function SectionChange({
  section,
  names,
  vocabulary,
}: {
  section: SectionDiff;
  names: ReadonlyMap<string, string>;
  vocabulary: readonly Tag[];
}): ReactNode {
  const name = (slug: string): string => names.get(slug) ?? slug;
  return (
    <li>
      <strong>{section.label}</strong>
      {section.change !== "changed" && <span className="muted"> {section.change}</span>}
      {section.renamedFrom !== undefined && (
        <span className="muted"> (was {section.renamedFrom})</span>
      )}
      {section.change !== "removed" && (
        <>
          {section.cardsAdded.map((slug) => (
            <span key={`+${slug}`} className="diff-chip" data-change="added">
              + {name(slug)}
            </span>
          ))}
          {section.cardsRemoved.map((slug) => (
            <span key={`-${slug}`} className="diff-chip" data-change="removed">
              − {name(slug)}
            </span>
          ))}
          <TagChanges
            added={section.tagsAdded}
            removed={section.tagsRemoved}
            vocabulary={vocabulary}
          />
        </>
      )}
    </li>
  );
}

export function Comparison({
  from,
  to,
  labelOf,
  cube,
}: {
  from: string;
  to: string;
  labelOf: (id: string) => string;
  cube: Workbench;
}): ReactNode {
  const { data: diff, error } = useQuery({
    queryKey: [...VERSIONS_QUERY_KEY, "compare", from, to],
    queryFn: () => compareRequest(from, to),
  });
  if (error) {
    return (
      <p role="alert" className="error">
        {error.message}
      </p>
    );
  }
  if (!diff) {
    return <p className="muted">Comparing…</p>;
  }
  const vocabulary = diff.vocabulary;
  const names = new Map(Object.entries(diff.names));
  const live = new Set(cube.cards.map((card) => card.slug));
  const empty =
    diff.cards.length === 0 &&
    diff.sections.length === 0 &&
    diff.tags.added.length + diff.tags.removed.length + diff.tags.changed.length === 0;
  return (
    <section className="comparison" aria-label="Comparison">
      <table className="tag-table diff-counts" aria-label="Card counts">
        <thead>
          <tr>
            <td />
            {CARD_STATUSES.map((status) => (
              <th key={status}>{CARD_STATUS_LABELS[status]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{labelOf(from)}</th>
            {CARD_STATUSES.map((status) => (
              <td key={status}>{diff.counts.before[status]}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">{labelOf(to)}</th>
            {CARD_STATUSES.map((status) => (
              <td key={status}>{diff.counts.after[status]}</td>
            ))}
          </tr>
        </tbody>
      </table>
      {empty ? (
        <p className="muted">No changes.</p>
      ) : (
        <div className="diff-groups">
          <CardGroups diff={diff} vocabulary={vocabulary} live={live} />
          <TagGroup tags={diff.tags} />
          {diff.sections.length > 0 && (
            <DiffGroup title="Board sections" count={diff.sections.length}>
              <ul className="diff-cards">
                {diff.sections.map((section) => (
                  <SectionChange
                    key={section.id}
                    section={section}
                    names={names}
                    vocabulary={vocabulary}
                  />
                ))}
              </ul>
            </DiffGroup>
          )}
        </div>
      )}
    </section>
  );
}
