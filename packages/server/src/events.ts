export const CUBE_CHANGED_EVENT = "cube:changed";

export const CUBES_CHANNEL = {
  list: "cubes:list",
  create: "cubes:create",
  openFolder: "cubes:open-folder",
  switchTo: "cubes:switch",
  remove: "cubes:remove",
} as const;

export interface CubeRef {
  dir: string;
  id: string;
  name: string;
}

export interface CubeList {
  current: CubeRef;
  recent: CubeRef[];
}

export interface CubesBridge {
  list: () => Promise<CubeList>;
  create: (name: string) => Promise<CubeRef>;
  openFolder: () => Promise<CubeRef | undefined>;
  switchTo: (dir: string) => Promise<CubeRef>;
  remove: (dir: string) => Promise<CubeList>;
}

export interface DesktopBridge {
  onCubeChanged: (listener: () => void) => () => void;
  cubes: CubesBridge;
}
