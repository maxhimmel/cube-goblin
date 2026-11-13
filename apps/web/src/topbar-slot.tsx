import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { createPortal } from "react-dom";

export const TopbarSlot = createContext<HTMLElement | null>(null);

export function InTopbar({ children }: { children: ReactNode }): ReactNode {
  const slot = useContext(TopbarSlot);
  return slot ? createPortal(children, slot) : null;
}
