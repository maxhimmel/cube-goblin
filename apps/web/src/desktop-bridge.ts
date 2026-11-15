import type { DesktopBridge } from "@repo/server/events";
import { CUBE_CHANGED_EVENT } from "./workbench/api.ts";

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export function onCubeChanged(listener: () => void): void {
  if (import.meta.hot) {
    import.meta.hot.on(CUBE_CHANGED_EVENT, listener);
  }
  window.desktop?.onCubeChanged(listener);
}
