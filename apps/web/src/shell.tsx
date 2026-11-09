import { mode } from "#mode";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }): ReactNode {
  const cube = mode.useCube();

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          Max&apos;s Cube
        </Link>
        <span className="muted" data-testid="cube-label">
          {cube ? `${String(cube.cards.length)} cards · ${cube.label}` : "loading…"}
        </span>
        <Link to="/wall">Wall</Link>
        <mode.Toolbar />
      </header>
      <main>{children}</main>
    </div>
  );
}
