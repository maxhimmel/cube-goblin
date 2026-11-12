import type { ReactNode } from "react";
import { z } from "zod";
import { useRemembered } from "../view-choices.ts";

export function Block({
  title,
  caption,
  table,
  collapsed,
  onToggle,
  onHide,
  heading,
  actions,
  children,
}: {
  title: string;
  caption?: ReactNode;
  table?: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  onHide?: (() => void) | undefined;
  heading?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}): ReactNode {
  const [asTable, setAsTable] = useRemembered(`table.insights.${title}`, false, z.boolean());
  return (
    <section className="block" data-collapsed={collapsed} aria-label={title}>
      <header className="block-head" title="Drag to move">
        <span className="block-grip" aria-hidden="true" />
        <h2>{heading ?? title}</h2>
        <div className="block-actions">
          {!collapsed && actions}
          {table !== undefined && !collapsed && (
            <button
              type="button"
              className="chart-toggle"
              aria-pressed={asTable}
              onClick={() => {
                setAsTable(!asTable);
              }}
            >
              Table
            </button>
          )}
          <button
            type="button"
            className="block-collapse"
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            onClick={onToggle}
          />
          {onHide && (
            <button
              type="button"
              className="block-hide"
              aria-label={`Hide ${title}`}
              title="Hide (bring it back from Blocks)"
              onClick={onHide}
            >
              ×
            </button>
          )}
        </div>
      </header>
      {!collapsed && (
        <>
          {caption !== undefined && <p className="muted chart-caption">{caption}</p>}
          <div className="block-body" data-table={asTable}>
            {asTable ? table : children}
          </div>
        </>
      )}
    </section>
  );
}
