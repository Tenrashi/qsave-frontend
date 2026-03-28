import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "@/lib/constants/constants";

export const computeContentHash = async (
  savePaths: string[],
  filePaths: string[],
): Promise<string> =>
  invoke<string>(TAURI_COMMANDS.computeSaveHash, {
    savePaths,
    files: filePaths,
  });
