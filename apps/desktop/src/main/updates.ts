import { app, ipcMain, shell } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import electronUpdater from "electron-updater";
import { NEWER_RELEASE_CHANNEL, OPEN_DOWNLOAD_CHANNEL } from "@repo/server";
import pkg from "../../package.json" with { type: "json" };

const { owner, repo } = pkg.build.publish;
const RELEASE_PAGE = `https://github.com/${owner}/${repo}/releases/latest`;

async function checkNewerRelease(): Promise<string | undefined> {
  if (!app.isPackaged) {
    return undefined;
  }
  const { autoUpdater } = electronUpdater;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  try {
    const result = await autoUpdater.checkForUpdates();
    return result?.isUpdateAvailable === true ? result.updateInfo.version : undefined;
  } catch (error) {
    console.warn(`Update check failed: ${String(error)}`);
    return undefined;
  }
}

export function serveUpdates(allowed: (event: IpcMainInvokeEvent) => boolean): void {
  let newer: Promise<string | undefined> | undefined;
  ipcMain.handle(NEWER_RELEASE_CHANNEL, (event) => {
    if (!allowed(event)) {
      throw new Error("Not allowed");
    }
    newer ??= checkNewerRelease();
    return newer;
  });
  ipcMain.handle(OPEN_DOWNLOAD_CHANNEL, async (event) => {
    if (!allowed(event)) {
      throw new Error("Not allowed");
    }
    await shell.openExternal(RELEASE_PAGE);
  });
}
