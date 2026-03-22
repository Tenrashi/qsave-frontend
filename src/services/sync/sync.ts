import { RECORD_STATUS } from "@/domain/types";
import type { Game, SyncRecord } from "@/domain/types";
import { APP_NAME } from "@/lib/constants/constants";
import { uploadGameArchive, updateDevicePaths } from "@/services/drive/drive";
import { addSyncRecord, getDeviceId } from "@/lib/store/store";
import { notify } from "@/lib/notify/notify";
import i18n from "@/i18n";

export const syncGame = async (game: Game): Promise<SyncRecord> => {
  const id = `${game.name}-${Date.now()}`;
  const filePaths = game.saveFiles.map((file) => file.path);

  try {
    const { fileId } = await uploadGameArchive(
      game.name,
      game.savePaths,
      filePaths,
    );

    if (game.isManual) {
      getDeviceId()
        .then((deviceId) =>
          updateDevicePaths(deviceId, game.name, game.savePaths),
        )
        .catch(() => {});
    }

    const record: SyncRecord = {
      id,
      gameName: game.name,
      fileName: `${game.name}.zip`,
      syncedAt: new Date(),
      driveFileId: fileId,
      revisionCount: 1,
      status: RECORD_STATUS.success,
    };

    await addSyncRecord(record);
    await notify(
      APP_NAME,
      i18n.t("notifications.syncSuccess", { name: game.name }),
    );
    return record;
  } catch (err) {
    const record: SyncRecord = {
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

export const syncAllGames = async (games: Game[]): Promise<SyncRecord[]> => {
  const results: SyncRecord[] = [];
  for (const game of games) {
    const record = await syncGame(game);
    results.push(record);
  }
  return results;
};
