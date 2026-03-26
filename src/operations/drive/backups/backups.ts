import { invoke } from "@tauri-apps/api/core";
import type { DriveBackup } from "@/domain/types";
import { TAURI_COMMANDS, MAX_SAVES_PER_GAME } from "@/lib/constants/constants";
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

export const listBackedUpGameNames = async (): Promise<string[]> => {
  try {
    const rootId = await ensureQSaveFolder();
    return await getFolderNames(rootId);
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
): Promise<{ fileId: string }> => {
  try {
    const zipBytes: number[] = await invoke(TAURI_COMMANDS.createZip, {
      savePaths,
      files: filePaths,
    });
    const zipData = new Uint8Array(zipBytes);

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

    return await postFile(folderId, archiveName, zipData);
  } catch (error) {
    throw new Error(
      `Failed to upload archive for "${gameName}": ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};
