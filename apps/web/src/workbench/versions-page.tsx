import type {
  CardDiff,
  CardStatus,
  CubeDiff,
  SectionDiff,
  Tag,
  VersionSummary,
  Workbench,
} from "@repo/cube/browser";
import { CARD_STATUSES, CURRENT, tagLabel } from "@repo/cube/browser";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { CardLink } from "../card-pane.tsx";
import { queryClient } from "../query-client.ts";
import { VERSIONS_QUERY_KEY, compareRequest, fetchVersions, saveVersionRequest } from "./api.ts";
import { showToast } from "./toast.tsx";

const STATUS_LABELS: Record<CardStatus, string> = {
  draft: "Draft",
  prospect: "Prospect",
  cut: "Cut",
};

function versionName(id: string, versions: readonly VersionSummary[]): string {
  return id === CURRENT
    ? "Current cube"
    : (versions.find((version) => version.id === id)?.label ?? id);
}

function savedOn(savedAt: string): string {
  return new Date(savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function SaveVersion(): ReactNode {
  const [label, setLabel] = useState("");
  const save = useMutation({
    mutationFn: saveVersionRequest,
    onSuccess: async (version) => {
      setLabel("");
      showToast({ message: `Saved version "${version.label}"`, tone: "info" });
      await queryClient.invalidateQueries({ queryKey: VERSIONS_QUERY_KEY });
    },
    onError: (error) => {
      showToast({ message: error.message, tone: "error" });
    },
  });
  return (
    <form
      className="inline"
      onSubmit={(event) => {
        event.preventDefault();
        if (label.trim()) {
          save.mutate(label.trim());
        }
      }}
    >
      <input
        aria-label="Version name"
        value={label}
        onChange={(event) => {
          setLabel(event.target.value);
        }}
        placeholder="name this version, e.g. before the trim"
        size={36}
      />
      <button type="submit" disabled={save.isPending || !label.trim()}>
        Save version
      </button>
    </form>
  );
}

function VersionList({ versions }: { versions: readonly VersionSummary[] }): ReactNode {
  if (versions.length === 0) {
    return <p className="muted">No saved versions yet.</p>;
  }
  return (
    <table className="tag-table version-table">
      <thead>
        <tr>
          <th>Version</th>
          <th>Saved</th>
          {CARD_STATUSES.map((status) => (
            <th key={status}>{STATUS_LABELS[status]}</th>
          ))}
          <th>Compare</th>
        </tr>
      </thead>
      <tbody>
        {versions.map((version) => (
          <tr key={version.id} data-version={version.id}>
            <td>{version.label}</td>
            <td className="muted">{savedOn(version.savedAt)}</td>
            {CARD_STATUSES.map((status) => (
              <td key={status}>{version.counts[status]}</td>
            ))}
            <td>
              <CompareLink from={version.id} to={CURRENT}>
                Compare with now
              </CompareLink>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CompareLink({
  from,
  to,
  children,
}: {
  from: string;
  to: string;
  children: ReactNode;
}): ReactNode {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="link-button"
      onClick={() => {
        void navigate({ to: "/versions", search: { from, to }, resetScroll: false });
      }}
    >
      {children}
    </button>
  );
}

function VersionSelect({
  label,
  value,
  versions,
  onChange,
}: {
  label: string;
  value: string;
  versions: readonly VersionSummary[];
  onChange: (next: string) => void;
}): ReactNode {
  return (
    <label className="field-inline">
      {label}
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        <option value={CURRENT}>Current cube</option>
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            {version.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CardName({ slug, name }: { slug: string; name: string }): ReactNode {
  return <CardLink slug={slug}>{name}</CardLink>;
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
  const from = card.before === undefined ? "Not in cube" : STATUS_LABELS[card.before];
  const to = card.after === undefined ? "Not in cube" : STATUS_LABELS[card.after];
  return `${from} → ${to}`;
}

function CardGroups({ diff, vocabulary }: { diff: CubeDiff; vocabulary: readonly Tag[] }) {
  const moved = diff.cards.filter(
    (card) => card.before !== undefined && card.after !== undefined && card.before !== card.after,
  );
  const added = diff.cards.filter((card) => card.before === undefined);
  const removed = diff.cards.filter((card) => card.after === undefined);
  const edited = diff.cards.filter(
    (card) =>
      card.before !== undefined &&
      card.after !== undefined &&
      (card.tagsAdded.length + card.tagsRemoved.length > 0 ||
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
                <CardName slug={card.slug} name={card.name} />
                {card.after && <span className="muted"> as {STATUS_LABELS[card.after]}</span>}
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
                <CardName slug={card.slug} name={card.name} />
              </li>
            ))}
          </ul>
        </DiffGroup>
      ))}
      {removed.length > 0 && (
        <DiffGroup title="Gone" count={removed.length}>
          <ul className="diff-cards">
            {removed.map((card) => (
              <li key={card.slug}>{card.name}</li>
            ))}
          </ul>
        </DiffGroup>
      )}
      {edited.length > 0 && (
        <DiffGroup title="Edited" count={edited.length}>
          <ul className="diff-cards">
            {edited.map((card) => (
              <li key={card.slug}>
                <CardName slug={card.slug} name={card.name} />
                <TagChanges
                  added={card.tagsAdded}
                  removed={card.tagsRemoved}
                  vocabulary={vocabulary}
                />
                {card.notesChanged && <span className="diff-chip">notes</span>}
                {card.printingChanged && <span className="diff-chip">printing</span>}
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
            {before.label === after.label ? after.label : `${before.label} → ${after.label}`}
            {before.kind !== after.kind && (
              <span className="muted">
                {" "}
                ({before.kind} → {after.kind})
              </span>
            )}
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

function Comparison({
  from,
  to,
  versions,
  cube,
}: {
  from: string;
  to: string;
  versions: readonly VersionSummary[];
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
  const vocabulary = [...cube.vocabulary, ...diff.tags.removed];
  const names = new Map(cube.cards.map((card) => [card.slug, card.name]));
  const empty =
    diff.cards.length === 0 &&
    diff.sections.length === 0 &&
    diff.tags.added.length + diff.tags.removed.length + diff.tags.changed.length === 0;
  return (
    <div className="comparison" aria-label="Comparison">
      <table className="tag-table diff-counts" aria-label="Card counts">
        <thead>
          <tr>
            <th />
            {CARD_STATUSES.map((status) => (
              <th key={status}>{STATUS_LABELS[status]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{versionName(from, versions)}</th>
            {CARD_STATUSES.map((status) => (
              <td key={status}>{diff.counts.before[status]}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">{versionName(to, versions)}</th>
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
          <CardGroups diff={diff} vocabulary={vocabulary} />
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
    </div>
  );
}

export function VersionsPage({ cube }: { cube: Workbench | undefined }): ReactNode {
  const search = useSearch({ from: "/versions" });
  const navigate = useNavigate();
  const { data: versions, error } = useQuery({
    queryKey: VERSIONS_QUERY_KEY,
    queryFn: fetchVersions,
  });
  if (!cube || !versions) {
    return error ? (
      <p role="alert" className="error">
        {error.message}
      </p>
    ) : (
      <p className="muted">Loading versions…</p>
    );
  }
  const from = search.from ?? versions[0]?.id;
  const to = search.to ?? CURRENT;
  const pick = (next: { from?: string; to?: string }): void => {
    void navigate({
      to: "/versions",
      search: { from: next.from ?? from, to: next.to ?? to },
      resetScroll: false,
    });
  };

  return (
    <div className="versions-page">
      <h1>Versions</h1>
      <p className="muted">
        A version saves the whole cube: every card with its status, tags, notes, and printing, plus
        the tag list and Board sections. Files live in <code>cube/versions/</code>.
      </p>
      <SaveVersion />
      <VersionList versions={versions} />
      {from !== undefined && (
        <section className="compare" aria-labelledby="compare-title">
          <h2 id="compare-title">Compare</h2>
          <div className="inline compare-pickers">
            <VersionSelect
              label="From"
              value={from}
              versions={versions}
              onChange={(next) => {
                pick({ from: next });
              }}
            />
            <VersionSelect
              label="To"
              value={to}
              versions={versions}
              onChange={(next) => {
                pick({ to: next });
              }}
            />
          </div>
          <Comparison from={from} to={to} versions={versions} cube={cube} />
        </section>
      )}
    </div>
  );
}
