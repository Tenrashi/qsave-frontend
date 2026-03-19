import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "@/lib/constants/constants";

export const notify = async (title: string, body: string): Promise<void> => {
  try {
    await invoke(TAURI_COMMANDS.sendNativeNotification, { title, body });
  } catch (err) {
    console.warn("[notify] Failed:", err);
  }
};
