import type { LogEntry, WorkbenchCard } from "@repo/cube/browser";
import { parseMessage } from "@repo/cube/browser";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LOG_QUERY_KEY, fetchLog } from "./api.ts";

function touches(entry: LogEntry, card: WorkbenchCard): boolean {
  return (
    entry.changes.cards.some(
      (change) => (change.after ?? change.before)?.oracleId === card.oracleId,
    ) ||
    entry.changes.sections.some((change) =>
      [...(change.before?.cards ?? []), ...(change.after?.cards ?? [])].includes(card.slug),
    )
  );
}

function when(at: string): string {
  return new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function CardHistory({ card }: { card: WorkbenchCard }): ReactNode {
  const log = useQuery({ queryKey: LOG_QUERY_KEY, queryFn: fetchLog });
  const entries = (log.data ?? []).filter((entry) => touches(entry, card)).reverse();
  return (
    <section className="field card-history" aria-label="History">
      <h3>History</h3>
      {entries.length === 0 ? (
        <p className="muted">No logged edits yet.</p>
      ) : (
        <ol>
          {entries.map((entry) => {
            const message = parseMessage(entry.message);
            const own = message.trailers.find(
              ([key, value]) => key === "Card" && value.startsWith(card.name),
            );
            return (
              <li key={entry.id} data-testid="card-history-entry">
                <time dateTime={entry.at} className="muted">
                  {when(entry.at)}
                </time>{" "}
                <strong>{message.subject}</strong>
                {own && own[1] !== message.subject && (
                  <span className="muted"> · {own[1].slice(card.name.length).trim()}</span>
                )}
                {message.body !== "" && <p>{message.body}</p>}
              </li>
            );
          })}
        </ol>
      )}
      <Link to="/log" className="link-button">
        Open the change log
      </Link>
    </section>
  );
}
