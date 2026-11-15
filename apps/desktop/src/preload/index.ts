import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "@repo/server/events";
import { CUBE_CHANGED_EVENT } from "@repo/server/events";

const bridge: DesktopBridge = {
  onCubeChanged: (listener) => {
    const forward = (): void => {
      listener();
    };
    ipcRenderer.on(CUBE_CHANGED_EVENT, forward);
    return () => {
      ipcRenderer.off(CUBE_CHANGED_EVENT, forward);
    };
  },
};

contextBridge.exposeInMainWorld("desktop", bridge);
