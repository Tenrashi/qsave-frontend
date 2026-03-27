import { fetch } from "@tauri-apps/plugin-http";
import { getValidToken } from "@/operations/auth/auth/auth";
import type { DeviceEntry } from "@/operations/devices/devices.types";
import { DRIVE_ENDPOINTS, MIME_TYPES } from "@/lib/constants/constants";
import { buildMultipartBody } from "@/lib/drive/multipart/multipart";

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getValidToken();
  return { Authorization: `Bearer ${token}` };
};

const assertOk = async (res: Response, context: string) => {
  if (res.ok) return;
  let body = "";
  try {
    body = await res.text();
  } catch {
    // body stays empty
  }
  throw new Error(`${context}: ${res.status} ${res.statusText} ${body}`);
};

const escapeQueryValue = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export const postFolder = async (
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
  return data.id;
};

export const getFolder = async (
  name: string,
  parentId: string,
): Promise<string | null> => {
  try {
    const headers = await authHeaders();
    const query = `name='${escapeQueryValue(name)}' and '${parentId}' in parents and mimeType='${MIME_TYPES.googleFolder}' and trashed=false`;
    const res = await fetch(
      `${DRIVE_ENDPOINTS.api}/files?q=${encodeURIComponent(query)}&fields=files(id)`,
      { headers },
    );

    if (!res.ok) return null;
    const data = (await res.json()) as { files: { id: string }[] };
    return data.files.length > 0 ? data.files[0].id : null;
  } catch {
    return null;
  }
};

export const getFile = async (
  name: string,
  parentId: string,
): Promise<string | null> => {
  try {
    const headers = await authHeaders();
    const query = `name='${escapeQueryValue(name)}' and '${parentId}' in parents and trashed=false`;
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

export const getFilesInFolder = async (
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

export const getDeviceFile = async (
  fileId: string,
): Promise<DeviceEntry | null> => {
  try {
    const headers = await authHeaders();
    const res = await fetch(
      `${DRIVE_ENDPOINTS.api}/files/${fileId}?alt=media`,
      { headers },
    );
    if (!res.ok) return null;
    return (await res.json()) as DeviceEntry;
  } catch {
    return null;
  }
};

export const putDeviceFile = async (
  folderId: string,
  deviceId: string,
  entry: DeviceEntry,
  existingFileId: string | null,
): Promise<void> => {
  const content = JSON.stringify(entry, null, 2);
  const headers = await authHeaders();
  const fileName = `${deviceId}.json`;

  if (existingFileId) {
    const res = await fetch(
      `${DRIVE_ENDPOINTS.upload}/files/${existingFileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": MIME_TYPES.jsonUtf8,
        },
        body: content,
      },
    );
    await assertOk(res, "Failed to update device file");
    return;
  }

  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });
  const boundary = "qsave_device_" + Date.now();
  const body = buildMultipartBody(
    boundary,
    metadata,
    new TextEncoder().encode(content),
  );
  const res = await fetch(
    `${DRIVE_ENDPOINTS.upload}/files?uploadType=multipart`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body.buffer as ArrayBuffer,
    },
  );
  await assertOk(res, "Failed to create device file");
};

export const deleteFile = async (fileId: string): Promise<void> => {
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_ENDPOINTS.api}/files/${fileId}`, {
    method: "DELETE",
    headers,
  });
  await assertOk(res, "Failed to delete file");
};

export const getBackupFile = async (fileId: string): Promise<Uint8Array> => {
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

export const postFile = async (
  folderId: string,
  fileName: string,
  fileData: Uint8Array,
): Promise<{ fileId: string }> => {
  try {
    const headers = await authHeaders();
    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
    });

    const boundary = "qsave_boundary_" + Date.now();
    const body = buildMultipartBody(boundary, metadata, fileData);

    const res = await fetch(
      `${DRIVE_ENDPOINTS.upload}/files?uploadType=multipart`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: body.buffer as ArrayBuffer,
      },
    );

    await assertOk(res, "Failed to upload file");
    const data = (await res.json()) as { id: string };
    return { fileId: data.id };
  } catch (error) {
    throw new Error(
      `Failed to upload file "${fileName}": ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};

export const getFolderNames = async (parentId: string): Promise<string[]> => {
  try {
    const headers = await authHeaders();
    const query = `'${parentId}' in parents and mimeType='${MIME_TYPES.googleFolder}' and trashed=false`;
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
