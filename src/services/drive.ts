import { fetch } from "@tauri-apps/plugin-http";
import { readFile } from "@tauri-apps/plugin-fs";
import { getValidToken } from "@/services/auth";
import { getDriveFolderId, setDriveFolderId } from "@/lib/store";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

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

const createFolder = async (name: string, parentId: string): Promise<string> => {
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });

  await assertOk(res, "Failed to create folder");
  const data = await res.json() as { id: string };
  const key = parentId === "root" ? "__root__" : name;
  await setDriveFolderId(key, data.id);
  return data.id;
};

export const ensureQSaveFolder = async (): Promise<string> => {
  const existing = await getDriveFolderId("__root__");
  if (existing) {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${DRIVE_API}/files/${existing}?fields=id,trashed`, { headers });
      if (res.ok) {
        const data = await res.json() as { id: string; trashed: boolean };
        if (!data.trashed) return existing;
      }
    } catch {
      // Folder gone, recreate
    }
  }

  return createFolder("QSave", "root");
};

export const ensureGameFolder = async (gameName: string): Promise<string> => {
  const existing = await getDriveFolderId(gameName);
  if (existing) return existing;

  const rootId = await ensureQSaveFolder();
  return createFolder(gameName, rootId);
};

export const findFileInFolder = async (
  fileName: string,
  folderId: string,
): Promise<string | null> => {
  const headers = await authHeaders();
  const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    { headers },
  );

  await assertOk(res, "Failed to search files");
  const data = await res.json() as { files: { id: string }[] };
  return data.files.length > 0 ? data.files[0].id : null;
};

const buildMultipartBody = (
  boundary: string,
  metadata: string,
  fileContent: Uint8Array,
): Uint8Array => {
  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
  );
  const filePart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
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

export const uploadFile = async (
  localPath: string,
  fileName: string,
  gameName: string,
): Promise<{ fileId: string; isUpdate: boolean }> => {
  const folderId = await ensureGameFolder(gameName);
  const existingId = await findFileInFolder(fileName, folderId);

  const fileBytes = await readFile(localPath);
  const headers = await authHeaders();

  if (existingId) {
    const res = await fetch(`${UPLOAD_API}/files/${existingId}?uploadType=media`, {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/octet-stream",
      },
      body: fileBytes,
    });

    await assertOk(res, "Failed to update file");
    const data = await res.json() as { id: string };
    return { fileId: data.id, isUpdate: true };
  } else {
    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
    });

    const boundary = "qsave_boundary_" + Date.now();
    const body = buildMultipartBody(boundary, metadata, fileBytes);

    const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body as unknown as BodyInit,
    });

    await assertOk(res, "Failed to upload file");
    const data = await res.json() as { id: string };
    return { fileId: data.id, isUpdate: false };
  }
};

export const getRevisionCount = async (fileId: string): Promise<number> => {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${DRIVE_API}/files/${fileId}/revisions?fields=revisions(id)`, {
      headers,
    });
    if (!res.ok) return 1;
    const data = await res.json() as { revisions: { id: string }[] };
    return data.revisions?.length ?? 1;
  } catch {
    return 1;
  }
};
