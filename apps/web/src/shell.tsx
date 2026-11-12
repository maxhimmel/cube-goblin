import { mode } from "#mode";
import { Link, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { CardPane } from "./card-pane.tsx";

export function Shell({ children }: { children: ReactNode }): ReactNode {
  const cube = mode.useCube();
  const { card } = useSearch({ strict: false });
  const topbar = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = topbar.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        "--topbar-height",
        `${String(element.getBoundingClientRect().height)}px`,
      );
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="shell" data-pane={card !== undefined}>
      <header className="topbar" ref={topbar}>
        <Link to="/" className="brand">
          Max&apos;s Cube
        </Link>
        <span className="muted" data-testid="cube-label">
          {cube ? `${String(cube.cards.length)} cards · ${cube.label}` : "loading…"}
        </span>
        <nav className="views" aria-label="Views">
          <Link to="/" activeOptions={{ exact: true, includeSearch: false }}>
            Wall
          </Link>
          <Link to="/cards" activeOptions={{ includeSearch: false }}>
            Cards
          </Link>
          {mode.name === "workbench" && (
            <Link to="/board" activeOptions={{ includeSearch: false }}>
              Board
            </Link>
          )}
          <Link to="/tags" activeOptions={{ includeSearch: false }}>
            Tags
          </Link>
          <Link to="/insights" activeOptions={{ includeSearch: false }}>
            Insights
          </Link>
          {mode.name === "workbench" && (
            <Link to="/lab" activeOptions={{ includeSearch: false }}>
              Lab
            </Link>
          )}
          {mode.name === "workbench" && (
            <Link to="/versions" activeOptions={{ includeSearch: false }}>
              Versions
            </Link>
          )}
          <Link to="/log" activeOptions={{ includeSearch: false }}>
            Log
          </Link>
        </nav>
        <mode.Toolbar />
      </header>
      <main>{children}</main>
      {card !== undefined && <CardPane key={card} slug={card} />}
    </div>
  );
}
