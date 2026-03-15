import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { Game, SaveFile, SyncRecord } from "@/domain/types";
import { uploadFile, getRevisionCount } from "@/services/drive";
import { addSyncRecord } from "@/lib/store";

const notify = async (title: string, body: string) => {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    if (granted) {
      sendNotification({ title, body });
    }
  } catch {
    // Notification failure should never block sync
  }
};

export const syncFile = async (file: SaveFile): Promise<SyncRecord> => {
  const id = `${file.gameName}-${file.name}-${Date.now()}`;

  try {
    const { fileId, isUpdate } = await uploadFile(file.path, file.name, file.gameName);
    const revisionCount = isUpdate ? await getRevisionCount(fileId) : 1;

    const record: SyncRecord = {
      id,
      gameName: file.gameName,
      fileName: file.name,
      syncedAt: new Date(),
      driveFileId: fileId,
      revisionCount,
      status: "success",
    };

    await addSyncRecord(record);
    return record;
  } catch (err) {
    const record: SyncRecord = {
      id,
      gameName: file.gameName,
      fileName: file.name,
      syncedAt: new Date(),
      driveFileId: "",
      revisionCount: 0,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };

    await addSyncRecord(record);
    return record;
  }
};

export const syncGame = async (game: Game): Promise<SyncRecord[]> => {
  const results: SyncRecord[] = [];
  for (const file of game.saveFiles) {
    const record = await syncFile(file);
    results.push(record);
  }

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  if (errorCount === 0) {
    await notify("QSave", `${game.name}: ${successCount} save(s) synced`);
  } else {
    await notify("QSave", `${game.name}: ${successCount} synced, ${errorCount} failed`);
  }

  return results;
};

export const syncAllGames = async (games: Game[]): Promise<SyncRecord[]> => {
  const results: SyncRecord[] = [];
  for (const game of games) {
    const gameResults = await syncGame(game);
    results.push(...gameResults);
  }
  return results;
};
