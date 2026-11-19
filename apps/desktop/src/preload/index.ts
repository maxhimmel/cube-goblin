import { contextBridge, ipcRenderer } from "electron";
import type { CubeRef, DesktopBridge } from "@repo/server/events";
import {
  CUBE_CHANGED_EVENT,
  NEWER_RELEASE_CHANNEL,
  OPEN_DOWNLOAD_CHANNEL,
  OPEN_FOLDER_CHANNEL,
} from "@repo/server/events";

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
  newerRelease: () => ipcRenderer.invoke(NEWER_RELEASE_CHANNEL) as Promise<string | undefined>,
  openDownload: () => ipcRenderer.invoke(OPEN_DOWNLOAD_CHANNEL) as Promise<void>,
};

contextBridge.exposeInMainWorld("desktop", bridge);
