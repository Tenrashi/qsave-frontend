import { platform } from "@tauri-apps/plugin-os";
import type { DeviceEntry, DevicesMap, GameDeviceInfo } from "./devices.types";
import { normalizeGameInfo } from "./devices.types";
import {
  getDeviceFile,
  getFile,
  getFilesInFolder,
  putDeviceFile,
} from "@/services/drive/drive";
import { ensureDevicesFolder } from "@/operations/drive/folders/folders";

const currentOS = (): string => {
  const os = platform();
  if (os === "windows") return "windows";
  if (os === "macos") return "macos";
  return "linux";
};

let saveDeviceSyncLock: Promise<void> = Promise.resolve();

export const buildDevicesMap = async (): Promise<DevicesMap> => {
  try {
    const folderId = await ensureDevicesFolder();
    const files = await getFilesInFolder(folderId);
    const entries = await Promise.all(
      files.map(async (file) => {
        const entry = await getDeviceFile(file.id);
        if (!entry) return null;
        const deviceId = file.name.replace(/\.json$/, "");
        return [deviceId, entry] as const;
      }),
    );
    return Object.fromEntries(
      entries.filter(
        (entry): entry is readonly [string, DeviceEntry] => entry !== null,
      ),
    );
  } catch {
    return {};
  }
};

export const findDeviceGamePaths = async (
  deviceId: string,
  gameName: string,
): Promise<string[] | undefined> => {
  try {
    const folderId = await ensureDevicesFolder();
    const fileId = await getFile(`${deviceId}.json`, folderId);
    if (!fileId) return undefined;

    const entry = await getDeviceFile(fileId);
    if (!entry) return undefined;
    const gameInfo = entry.games[gameName];
    if (!gameInfo) return undefined;
    return normalizeGameInfo(gameInfo).paths;
  } catch {
    return undefined;
  }
};

export const saveDeviceSync = (
  deviceId: string,
  gameName: string,
  paths: string[],
  contentHash?: string,
): Promise<void> => {
  saveDeviceSyncLock = saveDeviceSyncLock.then(() =>
    saveDeviceSyncUnsafe(deviceId, gameName, paths, contentHash),
  );
  return saveDeviceSyncLock;
};

const saveDeviceSyncUnsafe = async (
  deviceId: string,
  gameName: string,
  paths: string[],
  contentHash?: string,
): Promise<void> => {
  try {
    const folderId = await ensureDevicesFolder();
    const existingFileId = await getFile(`${deviceId}.json`, folderId);
    let entry: DeviceEntry = { os: currentOS(), games: {} };

    if (existingFileId) {
      const existing = await getDeviceFile(existingFileId);
      if (existing) entry = existing;
    }

    const gameInfo: GameDeviceInfo = {
      paths,
      ...(contentHash && {
        lastHash: contentHash,
        lastSyncedAt: new Date().toISOString(),
      }),
    };
    entry.games[gameName] = gameInfo;
    await putDeviceFile(folderId, deviceId, entry, existingFileId);
  } catch (error) {
    throw new Error(
      `Failed to update device paths: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};

export const getCloudGameHash = async (
  gameName: string,
): Promise<{ hash: string; syncedAt: string } | null> => {
  try {
    const devicesMap = await buildDevicesMap();
    let latest: { hash: string; syncedAt: string } | null = null;

    for (const entry of Object.values(devicesMap)) {
      const raw = entry.games[gameName];
      if (!raw) continue;
      const gameInfo = normalizeGameInfo(raw);
      if (!gameInfo.lastHash || !gameInfo.lastSyncedAt) continue;
      if (
        !latest ||
        new Date(gameInfo.lastSyncedAt).getTime() >
          new Date(latest.syncedAt).getTime()
      ) {
        latest = {
          hash: gameInfo.lastHash,
          syncedAt: gameInfo.lastSyncedAt,
        };
      }
    }

    return latest;
  } catch {
    return null;
  }
};
