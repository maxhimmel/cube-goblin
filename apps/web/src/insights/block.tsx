import type { ReactNode } from "react";
import { useState } from "react";

export function Block({
  title,
  caption,
  table,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  caption?: ReactNode;
  table?: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}): ReactNode {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="block" data-collapsed={collapsed} aria-label={title}>
      <header className="block-head" title="Drag to move">
        <span className="block-grip" aria-hidden="true" />
        <h2>{title}</h2>
        <div className="block-actions">
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
