import { RECORD_STATUS } from "@/domain/types";
import type { Game, SyncRecord } from "@/domain/types";
import { APP_NAME } from "@/lib/constants";
import { uploadGameArchive } from "@/services/drive";
import { addSyncRecord } from "@/lib/store";
import { notify } from "@/lib/notify";

export const syncGame = async (game: Game): Promise<SyncRecord> => {
  const id = `${game.name}-${Date.now()}`;
  const filePaths = game.saveFiles.map((file) => file.path);

  try {
    const { fileId } = await uploadGameArchive(game.name, filePaths);

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
    await notify(APP_NAME, `${game.name}: ${game.saveFiles.length} save(s) synced`);
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
    await notify(APP_NAME, `${game.name}: sync failed`);
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
