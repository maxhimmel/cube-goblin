import type { CubeRef, CubesApi } from "@repo/server/events";

export type FolderOpener =
  | { kind: "dialog"; open: () => Promise<CubeRef | undefined> }
  | { kind: "path"; open: (dir: string) => Promise<CubeRef> };

export interface CubeHost {
  cubes: CubesApi;
  openFolder: FolderOpener;
  onCubeChanged: (listener: () => void) => () => void;
}
