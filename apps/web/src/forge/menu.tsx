import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function Menu({
  label,
  listLabel,
  children,
}: {
  label: ReactNode;
  listLabel: string;
  children: ReactNode;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<"start" | "end">("start");
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    const box = list.current?.getBoundingClientRect();
    const anchor = root.current?.getBoundingClientRect();
    if (!open || !box || !anchor) {
      return;
    }
    setAlign(anchor.left + box.width > window.innerWidth - 8 ? "end" : "start");
  }, [open]);

  return (
    <div
      ref={root}
      className="lab-menu"
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next !== null && !event.currentTarget.contains(next)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {label}
      </button>
      {open && (
        <div
          ref={list}
          className="lab-menu-list"
          role="group"
          aria-label={listLabel}
          data-align={align}
        >
          {children}
        </div>
      )}
    </div>
  );
}
