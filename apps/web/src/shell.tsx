import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { snapshot } from "./data.ts";
import { downloadSavedDocument, reviewCode, setReviewer, useReview } from "./review-store.ts";

export function Shell({ children }: { children: ReactNode }): ReactNode {
  const review = useReview();
  const [code, setCode] = useState<string | undefined>(undefined);
  const reviewed = Object.keys(review.cards).length;

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          Max&apos;s Cube
        </Link>
        <span className="muted">
          {snapshot.cards.length} cards · snapshot {snapshot.id}
        </span>
        <label className="reviewer">
          Your name
          <input
            aria-label="Your name"
            value={review.reviewer}
            onChange={(event) => {
              setReviewer(event.target.value);
            }}
            placeholder="who's reviewing?"
          />
        </label>
        <span className="muted" data-testid="reviewed-count">
          {reviewed} reviewed
        </span>
        <button type="button" onClick={downloadSavedDocument}>
          Save copy to send back
        </button>
        <button
          type="button"
          onClick={() => {
            const next = reviewCode();
            setCode(next);
            if (window.isSecureContext) {
              void navigator.clipboard.writeText(next).catch(() => undefined);
            }
          }}
        >
          Copy review code
        </button>
      </header>
      {code !== undefined && (
        <div className="code-panel">
          <textarea aria-label="Review code" readOnly value={code} rows={3} />
          <button
            type="button"
            onClick={() => {
              setCode(undefined);
            }}
          >
            Close
          </button>
        </div>
      )}
      <main>{children}</main>
    </div>
  );
}
