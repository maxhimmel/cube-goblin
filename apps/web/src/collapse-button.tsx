import type { ReactNode } from "react";

export function CollapseButton({
  title,
  collapsed,
  onToggle,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
      onClick={onToggle}
    >
      {collapsed ? "+" : "–"}
    </button>
  );
}
