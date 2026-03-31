import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "@/lib/constants/constants";

type KeychainTokens = {
  access_token: string | null;
  refresh_token: string | null;
};

export const setTokens = async (
  accessToken?: string,
  refreshToken?: string,
): Promise<void> => {
  await invoke(TAURI_COMMANDS.keychainSetTokens, {
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
  });
};

export const getTokens = async (): Promise<{
  accessToken?: string;
  refreshToken?: string;
}> => {
  const tokens = await invoke<KeychainTokens>(TAURI_COMMANDS.keychainGetTokens);

  return {
    accessToken: tokens.access_token ?? undefined,
    refreshToken: tokens.refresh_token ?? undefined,
  };
};

export const deleteTokens = async (): Promise<void> => {
  await invoke(TAURI_COMMANDS.keychainDeleteTokens);
};
