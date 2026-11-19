import { CUBE_CHANGED_EVENT } from "@repo/server/events";
import type { CubeHost } from "./host.ts";
import { httpCubes, openPath } from "./http-cubes.ts";

export function webHost(): CubeHost {
  return {
    cubes: httpCubes,
    openFolder: { kind: "path", open: openPath },
    onCubeChanged: (listener) => {
      const hot = import.meta.hot;
      if (hot === undefined) {
        return () => undefined;
      }
      hot.on(CUBE_CHANGED_EVENT, listener);
      return () => {
        hot.off(CUBE_CHANGED_EVENT, listener);
      };
    },
    newerRelease: () => Promise.resolve(undefined),
  };
}
