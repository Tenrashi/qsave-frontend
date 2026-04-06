import { invoke } from "@tauri-apps/api/core";
import { readFile, remove } from "@tauri-apps/plugin-fs";
import type { DriveBackup } from "@/domain/types";
import {
  TAURI_COMMANDS,
  SYSTEM_FOLDERS,
  MAX_SAVES_PER_GAME,
} from "@/lib/constants/constants";
import {
  getFilesInFolder,
  deleteFile,
  postFile,
  getFolderNames,
} from "@/services/drive/drive";
import {
  ensureQSaveFolder,
  ensureGameFolder,
} from "@/operations/drive/folders/folders";

const systemFolders = new Set<string>(SYSTEM_FOLDERS);

export const listBackedUpGameNames = async (): Promise<string[]> => {
  try {
    const rootId = await ensureQSaveFolder();
    const names = await getFolderNames(rootId);
    return names.filter((name) => !systemFolders.has(name));
  } catch {
    return [];
  }
};

export const listGameBackups = async (
  gameName: string,
): Promise<DriveBackup[]> => {
  try {
    const folderId = await ensureGameFolder(gameName);
    const files = await getFilesInFolder(folderId);
    return files
      .map((file) => ({
        id: file.id,
        name: file.name,
        createdTime: file.createdTime,
      }))
      .reverse();
  } catch (error) {
    throw new Error(
      `Failed to list backups for "${gameName}": ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};

export const deleteGameBackup = async (fileId: string): Promise<void> => {
  try {
    await deleteFile(fileId);
  } catch (error) {
    throw new Error(
      `Failed to delete backup "${fileId}": ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};

export const uploadGameArchive = async (
  gameName: string,
  savePaths: string[],
  filePaths: string[],
): Promise<{ fileId: string; contentHash: string }> => {
  const result: { temp_path: string; content_hash: string } = await invoke(
    TAURI_COMMANDS.createZipFile,
    { savePaths, files: filePaths },
  );

  try {
    const zipData = await readFile(result.temp_path);

    const folderId = await ensureGameFolder(gameName);

    try {
      const existing = await getFilesInFolder(folderId);
      const toDelete = existing.slice(
        0,
        Math.max(0, existing.length - MAX_SAVES_PER_GAME + 1),
      );
      for (const file of toDelete) {
        await deleteFile(file.id);
      }
    } catch {
      // Cleanup failure should not block upload
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archiveName = `${gameName}_${timestamp}.zip`;

    const uploaded = await postFile(folderId, archiveName, zipData);
    return { ...uploaded, contentHash: result.content_hash };
  } finally {
    try {
      await remove(result.temp_path);
    } catch {
      // Best-effort cleanup
    }
  }
};
