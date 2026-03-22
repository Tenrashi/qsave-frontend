import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { getValidToken } from "@/services/auth/auth";
import { getDriveFolderId, setDriveFolderId } from "@/lib/store/store";
import type { DriveBackup } from "@/domain/types";
import {
  APP_NAME,
  STORE_KEYS,
  TAURI_COMMANDS,
  DRIVE_ENDPOINTS,
  MIME_TYPES,
  MAX_SAVES_PER_GAME,
} from "@/lib/constants/constants";

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getValidToken();
  return { Authorization: `Bearer ${token}` };
};

const assertOk = async (res: Response, context: string) => {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${context}: ${res.status} ${res.statusText} ${body}`);
  }
};

const createFolder = async (
  name: string,
  parentId: string,
): Promise<string> => {
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_ENDPOINTS.api}/files`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: MIME_TYPES.googleFolder,
      parents: [parentId],
    }),
  });

  await assertOk(res, "Failed to create folder");
  const data = (await res.json()) as { id: string };
  const key = parentId === "root" ? STORE_KEYS.rootFolder : name;
  await setDriveFolderId(key, data.id);
  return data.id;
};

const findFolder = async (
  name: string,
  parentId: string,
): Promise<string | null> => {
  const headers = await authHeaders();
  const query = `name='${name}' and '${parentId}' in parents and mimeType='${MIME_TYPES.googleFolder}' and trashed=false`;
  const res = await fetch(
    `${DRIVE_ENDPOINTS.api}/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    { headers },
  );

  if (!res.ok) return null;
  const data = (await res.json()) as { files: { id: string }[] };
  return data.files.length > 0 ? data.files[0].id : null;
};

export const ensureQSaveFolder = async (): Promise<string> => {
  try {
    const cached = await getDriveFolderId(STORE_KEYS.rootFolder);
    if (cached) {
      const found = await findFolder(APP_NAME, "root");
      if (found === cached) return cached;
    }

    const existing = await findFolder(APP_NAME, "root");
    if (existing) {
      await setDriveFolderId(STORE_KEYS.rootFolder, existing);
      return existing;
    }

    return await createFolder(APP_NAME, "root");
  } catch (error) {
    throw new Error(
      `Failed to ensure ${APP_NAME} folder: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};

export const ensureGameFolder = async (gameName: string): Promise<string> => {
  try {
    const rootId = await ensureQSaveFolder();

    const cached = await getDriveFolderId(gameName);
    if (cached) {
      const found = await findFolder(gameName, rootId);
      if (found === cached) return cached;
    }

    const existing = await findFolder(gameName, rootId);
    if (existing) {
      await setDriveFolderId(gameName, existing);
      return existing;
    }

    return await createFolder(gameName, rootId);
  } catch (error) {
    throw new Error(
      `Failed to ensure game folder "${gameName}": ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};

const DEVICES_FILENAME = "devices.json";

type DeviceEntry = {
  os: string;
  games: Record<string, string[]>;
};

export type DevicesMap = Record<string, DeviceEntry>;

const findFileInFolder = async (
  folderId: string,
  fileName: string,
): Promise<string | null> => {
  try {
    const headers = await authHeaders();
    const query = `'${folderId}' in parents and name='${fileName}' and trashed=false`;
    const res = await fetch(
      `${DRIVE_ENDPOINTS.api}/files?q=${encodeURIComponent(query)}&fields=files(id)`,
      { headers },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { files: { id: string }[] };
    return data.files[0]?.id ?? null;
  } catch {
    return null;
  }
};

const currentOS = (): string => {
  const platform = navigator.userAgent;
  if (platform.includes("Win")) return "windows";
  if (platform.includes("Mac")) return "macos";
  return "linux";
};

export const getDevicesMap = async (): Promise<DevicesMap> => {
  try {
    const rootId = await ensureQSaveFolder();
    const fileId = await findFileInFolder(rootId, DEVICES_FILENAME);
    if (!fileId) return {};

    const headers = await authHeaders();
    const res = await fetch(
      `${DRIVE_ENDPOINTS.api}/files/${fileId}?alt=media`,
      { headers },
    );
    if (!res.ok) return {};
    return (await res.json()) as DevicesMap;
  } catch {
    return {};
  }
};

export const getDeviceGamePaths = async (
  deviceId: string,
  gameName: string,
): Promise<string[] | undefined> => {
  const devices = await getDevicesMap();
  return devices[deviceId]?.games[gameName];
};

export const updateDevicePaths = async (
  deviceId: string,
  gameName: string,
  paths: string[],
): Promise<void> => {
  try {
    const rootId = await ensureQSaveFolder();
    const devices = await getDevicesMap();

    if (!devices[deviceId]) {
      devices[deviceId] = { os: currentOS(), games: {} };
    }
    devices[deviceId].games[gameName] = paths;

    const content = new TextEncoder().encode(JSON.stringify(devices, null, 2));
    const headers = await authHeaders();
    const existingFileId = await findFileInFolder(rootId, DEVICES_FILENAME);

    if (existingFileId) {
      const res = await fetch(
        `${DRIVE_ENDPOINTS.upload}/files/${existingFileId}?uploadType=media`,
        {
          method: "PATCH",
          headers: {
            ...headers,
            "Content-Type": MIME_TYPES.jsonUtf8,
          },
          body: content as unknown as BodyInit,
        },
      );
      await assertOk(res, "Failed to update devices");
      return;
    }

    const metadata = JSON.stringify({
      name: DEVICES_FILENAME,
      parents: [rootId],
    });
    const boundary = "qsave_devices_" + Date.now();
    const body = buildMultipartBody(boundary, metadata, content);
    const res = await fetch(
      `${DRIVE_ENDPOINTS.upload}/files?uploadType=multipart`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: body as unknown as BodyInit,
      },
    );
    await assertOk(res, "Failed to create devices");
  } catch (error) {
    throw new Error(
      `Failed to update device paths: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};

const listFilesInFolder = async (
  folderId: string,
): Promise<{ id: string; name: string; createdTime: string }[]> => {
  const headers = await authHeaders();
  const query = `'${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `${DRIVE_ENDPOINTS.api}/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime)&orderBy=createdTime`,
    { headers },
  );

  await assertOk(res, "Failed to list files");
  const data = (await res.json()) as {
    files: { id: string; name: string; createdTime: string }[];
  };
  return data.files;
};

const deleteFile = async (fileId: string): Promise<void> => {
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_ENDPOINTS.api}/files/${fileId}`, {
    method: "DELETE",
    headers,
  });
  await assertOk(res, "Failed to delete file");
};

export const buildMultipartBody = (
  boundary: string,
  metadata: string,
  fileContent: Uint8Array,
): Uint8Array => {
  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    `--${boundary}\r\nContent-Type: ${MIME_TYPES.jsonUtf8}\r\n\r\n${metadata}\r\n`,
  );
  const filePart = encoder.encode(
    `--${boundary}\r\nContent-Type: ${MIME_TYPES.octetStream}\r\n\r\n`,
  );
  const end = encoder.encode(`\r\n--${boundary}--`);

  const result = new Uint8Array(
    metadataPart.length + filePart.length + fileContent.length + end.length,
  );
  let offset = 0;
  result.set(metadataPart, offset);
  offset += metadataPart.length;
  result.set(filePart, offset);
  offset += filePart.length;
  result.set(fileContent, offset);
  offset += fileContent.length;
  result.set(end, offset);

  return result;
};

export const listBackedUpGameNames = async (): Promise<string[]> => {
  try {
    const rootId = await ensureQSaveFolder();
    const headers = await authHeaders();
    const query = `'${rootId}' in parents and mimeType='${MIME_TYPES.googleFolder}' and trashed=false`;
    const res = await fetch(
      `${DRIVE_ENDPOINTS.api}/files?q=${encodeURIComponent(query)}&fields=files(name)&pageSize=1000`,
      { headers },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { files: { name: string }[] };
    return data.files.map((file) => file.name);
  } catch {
    return [];
  }
};

export const listGameBackups = async (
  gameName: string,
): Promise<DriveBackup[]> => {
  try {
    const folderId = await ensureGameFolder(gameName);
    const files = await listFilesInFolder(folderId);
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

export const downloadBackup = async (fileId: string): Promise<Uint8Array> => {
  try {
    const headers = await authHeaders();
    const res = await fetch(
      `${DRIVE_ENDPOINTS.api}/files/${fileId}?alt=media`,
      { headers },
    );
    await assertOk(res, "Failed to download backup");
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    throw new Error(
      `Failed to download backup "${fileId}": ${error instanceof Error ? error.message : error}`,
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
    const headers = await authHeaders();

    // Delete oldest saves if at the limit
    try {
      const existing = await listFilesInFolder(folderId);
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

    // Upload new archive with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archiveName = `${gameName}_${timestamp}.zip`;

    const metadata = JSON.stringify({
      name: archiveName,
      parents: [folderId],
    });

    const boundary = "qsave_boundary_" + Date.now();
    const body = buildMultipartBody(boundary, metadata, zipData);

    const res = await fetch(
      `${DRIVE_ENDPOINTS.upload}/files?uploadType=multipart`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: body as unknown as BodyInit,
      },
    );

    await assertOk(res, "Failed to upload archive");
    const data = (await res.json()) as { id: string };
    return { fileId: data.id };
  } catch (error) {
    throw new Error(
      `Failed to upload archive for "${gameName}": ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};
