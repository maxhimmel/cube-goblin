import { contextBridge, ipcRenderer } from "electron";
import type { CubeRef, DesktopBridge } from "@repo/server/events";
import { CUBE_CHANGED_EVENT, OPEN_FOLDER_CHANNEL } from "@repo/server/events";

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
  openFolder: () => ipcRenderer.invoke(OPEN_FOLDER_CHANNEL) as Promise<CubeRef | undefined>,
};

contextBridge.exposeInMainWorld("desktop", bridge);
