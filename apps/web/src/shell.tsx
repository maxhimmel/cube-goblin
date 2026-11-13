import { mode } from "#mode";
import { Link, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { CardPane } from "./card-pane.tsx";
import type { ViewIconName } from "./icons.tsx";
import { ViewIcon } from "./icons.tsx";
import { TopbarSlot } from "./topbar-slot.tsx";

const VIEWS: readonly {
  to: "/" | "/board" | "/tags" | "/insights" | "/versions" | "/log";
  label: string;
  icon: ViewIconName;
  workbench: boolean;
}[] = [
  { to: "/", label: "Forge", icon: "forge", workbench: false },
  { to: "/board", label: "Board", icon: "board", workbench: true },
  { to: "/tags", label: "Tags", icon: "tags", workbench: false },
  { to: "/insights", label: "Insights", icon: "insights", workbench: false },
  { to: "/versions", label: "Versions", icon: "versions", workbench: true },
  { to: "/log", label: "Log", icon: "log", workbench: false },
];

export function Shell({ children }: { children: ReactNode }): ReactNode {
  const { card, add, replaces } = useSearch({ strict: false });
  const topbar = useRef<HTMLElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

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
    const onScroll = (): void => {
      element.dataset["stuck"] = String(window.scrollY > 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="shell" data-pane={card !== undefined}>
      <header className="topbar" ref={topbar}>
        <Link to="/" className="brand">
          Max&apos;s Cube
        </Link>
        <nav className="views" aria-label="Views">
          {VIEWS.filter((view) => !view.workbench || mode.name === "workbench").map((view) => (
            <Link
              key={view.to}
              to={view.to}
              activeOptions={{ exact: view.to === "/", includeSearch: false }}
            >
              <ViewIcon name={view.icon} />
              <span className="view-name">{view.label}</span>
            </Link>
          ))}
        </nav>
        <div className="topbar-view" ref={setSlot} />
        <mode.Toolbar />
      </header>
      <main>
        <TopbarSlot.Provider value={slot}>{children}</TopbarSlot.Provider>
      </main>
      {card !== undefined && <CardPane key={card} slug={card} />}
      {add === true && <mode.AddPanel key={`add:${replaces ?? ""}`} replaces={replaces} />}
    </div>
  );
}
