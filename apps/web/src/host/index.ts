import type { DesktopBridge } from "@repo/server/events";
import { desktopHost } from "./desktop.ts";
import type { CubeHost } from "./host.ts";
import { webHost } from "./web.ts";

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export type { CubeHost, FolderOpener, NewerRelease } from "./host.ts";

export const host: CubeHost =
  window.desktop === undefined ? webHost() : desktopHost(window.desktop);
