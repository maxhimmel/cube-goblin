export const CUBE_CHANGED_EVENT = "cube:changed";

export interface DesktopBridge {
  onCubeChanged: (listener: () => void) => () => void;
}
