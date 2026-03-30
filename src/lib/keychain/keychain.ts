import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "@/lib/constants/constants";

const KEYCHAIN_KEYS = {
  accessToken: "access_token",
  refreshToken: "refresh_token",
} as const;

export const setTokens = async (
  accessToken?: string,
  refreshToken?: string,
): Promise<void> => {
  const promises: Promise<void>[] = [];

  if (accessToken) {
    promises.push(
      invoke(TAURI_COMMANDS.keychainSet, {
        key: KEYCHAIN_KEYS.accessToken,
        value: accessToken,
      }),
    );
  }

  if (refreshToken) {
    promises.push(
      invoke(TAURI_COMMANDS.keychainSet, {
        key: KEYCHAIN_KEYS.refreshToken,
        value: refreshToken,
      }),
    );
  }

  await Promise.all(promises);
};

export const getTokens = async (): Promise<{
  accessToken?: string;
  refreshToken?: string;
}> => {
  const [accessToken, refreshToken] = await Promise.all([
    invoke<string | null>(TAURI_COMMANDS.keychainGet, {
      key: KEYCHAIN_KEYS.accessToken,
    }),
    invoke<string | null>(TAURI_COMMANDS.keychainGet, {
      key: KEYCHAIN_KEYS.refreshToken,
    }),
  ]);

  return {
    accessToken: accessToken ?? undefined,
    refreshToken: refreshToken ?? undefined,
  };
};

export const deleteTokens = async (): Promise<void> => {
  await Promise.all([
    invoke(TAURI_COMMANDS.keychainDelete, {
      key: KEYCHAIN_KEYS.accessToken,
    }),
    invoke(TAURI_COMMANDS.keychainDelete, {
      key: KEYCHAIN_KEYS.refreshToken,
    }),
  ]);
};
