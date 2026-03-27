import { RECORD_STATUS } from "@/domain/types";
import type { Game, SyncRecord } from "@/domain/types";
import { APP_NAME } from "@/lib/constants/constants";
import { uploadGameArchive } from "@/operations/drive/backups/backups";
import { saveDeviceSync } from "@/operations/devices/devices";
import { rescanGame } from "@/operations/scanner/scanner/scanner";
import { addSyncRecord, getDeviceId } from "@/lib/store/store";
import { useSyncStore } from "@/stores/sync";
import { notify } from "@/lib/notify/notify";
import i18n from "@/i18n";

export type SyncResult = SyncRecord & { contentHash?: string };

export const syncGame = async (game: Game): Promise<SyncResult> => {
  const id = `${game.name}-${Date.now()}`;

  try {
    const fresh = await rescanGame(game);
    const filePaths = fresh.saveFiles.map((file) => file.path);

    const { fileId, contentHash } = await uploadGameArchive(
      game.name,
      fresh.savePaths,
      filePaths,
    );

    try {
      const deviceId = await getDeviceId();
      await saveDeviceSync(deviceId, game.name, fresh.savePaths, contentHash);
    } catch (error) {
      console.warn("Failed to update device sync info:", error);
    }

    useSyncStore.getState().markGameBackedUp(game.name);

    const record: SyncResult = {
      id,
      gameName: game.name,
      fileName: `${game.name}.zip`,
      syncedAt: new Date(),
      driveFileId: fileId,
      revisionCount: 1,
      status: RECORD_STATUS.success,
      contentHash,
    };

    await addSyncRecord(record);
    await notify(
      APP_NAME,
      i18n.t("notifications.syncSuccess", { name: game.name }),
    );
    return record;
  } catch (err) {
    const record: SyncResult = {
      id,
      gameName: game.name,
      fileName: `${game.name}.zip`,
      syncedAt: new Date(),
      driveFileId: "",
      revisionCount: 0,
      status: RECORD_STATUS.error,
      error: err instanceof Error ? err.message : String(err),
    };

    await addSyncRecord(record);
    await notify(
      APP_NAME,
      i18n.t("notifications.syncFailed", { name: game.name }),
    );
    return record;
  }
};

export const syncAllGames = async (games: Game[]): Promise<SyncResult[]> => {
  const results: SyncResult[] = [];
  for (const game of games) {
    const record = await syncGame(game);
    results.push(record);
  }
  return results;
};
