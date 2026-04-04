import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TAURI_COMMANDS } from "@/lib/constants/constants";

export const notify = async (title: string, body: string): Promise<void> => {
  try {
    const focused = await getCurrentWindow().isFocused();
    if (focused) return;

    await invoke(TAURI_COMMANDS.sendNativeNotification, { title, body });
  } catch (err) {
    console.warn("[notify] Failed:", err);
  }
};
