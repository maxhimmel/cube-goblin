import { mode } from "#mode";
import { Link, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CardPane } from "./card-pane.tsx";
import type { ViewIconName } from "./icons.tsx";
import { ViewIcon } from "./icons.tsx";
import { TopbarSlot } from "./topbar-slot.tsx";
import { useCubeName } from "./cube-identity.ts";

const TypeScalePanel = import.meta.env.DEV ? lazy(() => import("./type-scale.tsx")) : null;

const VIEWS: readonly {
  to: "/" | "/tags" | "/insights" | "/history" | "/cubes";
  label: string;
  icon: ViewIconName;
  workbench: boolean;
}[] = [
  { to: "/", label: "Forge", icon: "forge", workbench: false },
  { to: "/tags", label: "Tags", icon: "tags", workbench: false },
  { to: "/insights", label: "Insights", icon: "insights", workbench: false },
  { to: "/history", label: "History", icon: "history", workbench: false },
  { to: "/cubes", label: "Cubes", icon: "cubes", workbench: true },
];

export function Shell({ children }: { children: ReactNode }): ReactNode {
  const { card, add, replaces } = useSearch({ strict: false });
  const cubeName = useCubeName();
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
        <div className="brand-group">
          <Link to="/" className="brand">
            {cubeName}
          </Link>
          <mode.CubeSwitcher />
        </div>
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
      {TypeScalePanel && (
        <Suspense>
          <TypeScalePanel />
        </Suspense>
      )}
    </div>
  );
}
