import type { DesktopBridge } from "@repo/server/events";
import type { CubeHost } from "./host.ts";
import { httpCubes } from "./http-cubes.ts";

export function desktopHost(bridge: DesktopBridge): CubeHost {
  return {
    cubes: httpCubes,
    openFolder: { kind: "dialog", open: () => bridge.openFolder() },
    onCubeChanged: (listener) => bridge.onCubeChanged(listener),
  };
}
