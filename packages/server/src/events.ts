import type { OfflineStatus, Workbench } from "@repo/cube/browser";

export const CUBE_CHANGED_EVENT = "cube:changed";
export const CUBES_ROUTE = "/api/cubes";
export const OPEN_FOLDER_CHANNEL = "cubes:open-folder";

export interface CubeRef {
  dir: string;
  id: string;
  name: string;
}

export interface CubeList {
  current: CubeRef;
  recent: CubeRef[];
}

export interface CubesApi {
  list: () => Promise<CubeList>;
  create: (name: string) => Promise<CubeRef>;
  switchTo: (dir: string) => Promise<CubeRef>;
  remove: (dir: string) => Promise<CubeList>;
  offlineStatus: (dir: string) => Promise<OfflineStatus>;
  cards: (dir: string) => Promise<Workbench>;
}

export interface DesktopBridge {
  onCubeChanged: (listener: () => void) => () => void;
  openFolder: () => Promise<CubeRef | undefined>;
}
