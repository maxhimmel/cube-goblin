import { contextBridge, ipcRenderer } from "electron";
import type { OfflineStatus } from "@repo/cube/browser";
import type { CubeList, CubeRef, DesktopBridge } from "@repo/server/events";
import { CUBE_CHANGED_EVENT, CUBES_CHANNEL } from "@repo/server/events";

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
  cubes: {
    list: () => ipcRenderer.invoke(CUBES_CHANNEL.list) as Promise<CubeList>,
    create: (name) => ipcRenderer.invoke(CUBES_CHANNEL.create, name) as Promise<CubeRef>,
    openFolder: () => ipcRenderer.invoke(CUBES_CHANNEL.openFolder) as Promise<CubeRef | undefined>,
    switchTo: (dir) => ipcRenderer.invoke(CUBES_CHANNEL.switchTo, dir) as Promise<CubeRef>,
    remove: (dir) => ipcRenderer.invoke(CUBES_CHANNEL.remove, dir) as Promise<CubeList>,
    offlineStatus: (dir) =>
      ipcRenderer.invoke(CUBES_CHANNEL.offlineStatus, dir) as Promise<OfflineStatus>,
  },
};

contextBridge.exposeInMainWorld("desktop", bridge);
