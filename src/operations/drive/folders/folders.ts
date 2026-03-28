import {
  APP_NAME,
  STORE_KEYS,
  SYSTEM_FOLDERS,
} from "@/lib/constants/constants";
import { getDriveFolderId, setDriveFolderId } from "@/lib/store/store";
import { getFolder, postFolder } from "@/services/drive/drive";

const [DEVICES_FOLDER_NAME] = SYSTEM_FOLDERS;

const ensureFolder = async (
  name: string,
  parentId: string,
  cacheKey: string,
): Promise<string> => {
  const cached = await getDriveFolderId(cacheKey);
  const found = await getFolder(name, parentId);

  if (found) {
    if (found !== cached) await setDriveFolderId(cacheKey, found);
    return found;
  }

  const id = await postFolder(name, parentId);
  await setDriveFolderId(cacheKey, id);
  return id;
};

export const ensureQSaveFolder = async (): Promise<string> => {
  try {
    return await ensureFolder(APP_NAME, "root", STORE_KEYS.rootFolder);
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
    return await ensureFolder(gameName, rootId, gameName);
  } catch (error) {
    throw new Error(
      `Failed to ensure game folder "${gameName}": ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};

export const ensureDevicesFolder = async (): Promise<string> => {
  try {
    const rootId = await ensureQSaveFolder();
    return await ensureFolder(DEVICES_FOLDER_NAME, rootId, DEVICES_FOLDER_NAME);
  } catch (error) {
    throw new Error(
      `Failed to ensure devices folder: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
};
