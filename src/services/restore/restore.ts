import { invoke } from "@tauri-apps/api/core";
import { RECORD_STATUS } from "@/domain/types";
import type { Game, SyncRecord } from "@/domain/types";
import { APP_NAME, TAURI_COMMANDS } from "@/lib/constants/constants";
import { downloadBackup } from "@/services/drive/drive";
import { addSyncRecord } from "@/lib/store/store";
import { notify } from "@/lib/notify/notify";
import type { ZipMeta, ExtractResult } from "./restore.types";

export const restoreGame = async (
  game: Game,
  backupId: string,
): Promise<SyncRecord> => {
  const id = `${game.name}-restore-${Date.now()}`;

  try {
    const zipBytes = await downloadBackup(backupId);
    const zipArray = Array.from(zipBytes);

    const meta: ZipMeta | null = await invoke(TAURI_COMMANDS.readZipMeta, {
      zipBytes: zipArray,
    });

    // Determine target directories for extraction.
    // If meta has save_paths recorded, map them to local paths by index.
    // The game's current savePaths (resolved for this OS) are the targets.
    const targetDirs = meta?.save_paths.length
      ? game.savePaths.slice(0, meta.save_paths.length)
      : game.savePaths.slice(0, 1);

    if (targetDirs.length === 0) {
      throw new Error("No save paths available for restore");
    }

    const result: ExtractResult = await invoke(TAURI_COMMANDS.extractZip, {
      zipBytes: zipArray,
      targetDirs,
    });

    const record: SyncRecord = {
      id,
      gameName: game.name,
      fileName: `${game.name}.zip`,
      syncedAt: new Date(),
      driveFileId: backupId,
      revisionCount: result.file_count,
      status: RECORD_STATUS.success,
      type: "restore",
    };

    await addSyncRecord(record);
    await notify(APP_NAME, `${game.name}: ${result.file_count} file(s) restored`);
    return record;
  } catch (err) {
    const record: SyncRecord = {
      id,
      gameName: game.name,
      fileName: `${game.name}.zip`,
      syncedAt: new Date(),
      driveFileId: backupId,
      revisionCount: 0,
      status: RECORD_STATUS.error,
      type: "restore",
      error: err instanceof Error ? err.message : String(err),
    };

    await addSyncRecord(record);
    await notify(APP_NAME, `${game.name}: restore failed`);
    return record;
  }
};
