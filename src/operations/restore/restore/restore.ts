import { invoke } from "@tauri-apps/api/core";
import { RECORD_STATUS } from "@/domain/types";
import type { Game, SyncRecord } from "@/domain/types";
import { APP_NAME, TAURI_COMMANDS } from "@/lib/constants/constants";
import { downloadBackupToTempFile } from "@/services/drive/drive";
import { addSyncRecord } from "@/lib/store/store";
import { notify } from "@/lib/notify/notify";
import i18n from "@/i18n";
import type { ZipMeta, ExtractResult } from "./restore.types";

const deleteTempFile = async (filePath: string): Promise<void> => {
  try {
    await invoke(TAURI_COMMANDS.deleteTempFile, { filePath });
  } catch {
    // Best-effort cleanup: the temp file is in the OS temp dir and will be
    // cleaned up eventually. Don't mask the real error, if any.
  }
};

export const restoreGame = async (
  game: Game,
  backupId: string,
  overrideTargetDirs?: string[],
): Promise<SyncRecord> => {
  const id = `${game.name}-restore-${Date.now()}`;
  let tempPath: string | null = null;

  try {
    // Stream the backup straight to disk via Rust. Previously this downloaded
    // the whole zip into a JS Uint8Array, ran Array.from() over it (8x memory
    // blowup from boxed Numbers), then shipped the giant array across the
    // Tauri IPC boundary twice — which OOMed the webview on multi-GB saves.
    const downloaded = await downloadBackupToTempFile(backupId);
    tempPath = downloaded.tempPath;

    const meta: ZipMeta | null = await invoke(TAURI_COMMANDS.readZipMetaFile, {
      zipPath: tempPath,
    });

    const metaPathCount = meta?.save_paths.length ?? 1;
    const targetDirs =
      overrideTargetDirs ?? game.savePaths.slice(0, metaPathCount);

    if (targetDirs.length === 0) {
      throw new Error("No save paths available for restore");
    }

    const result: ExtractResult = await invoke(TAURI_COMMANDS.extractZipFile, {
      zipPath: tempPath,
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
    await notify(
      APP_NAME,
      i18n.t("notifications.restoreSuccess", { name: game.name }),
    );
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
    await notify(
      APP_NAME,
      i18n.t("notifications.restoreFailed", { name: game.name }),
    );
    return record;
  } finally {
    if (tempPath) {
      await deleteTempFile(tempPath);
    }
  }
};
