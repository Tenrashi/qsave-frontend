import { load, type Store } from "@tauri-apps/plugin-store";
import type {
  AuthState,
  SyncRecord,
  GameSyncFingerprint,
} from "@/domain/types";
import {
  STORE_KEYS,
  MAX_SYNC_HISTORY_RECORDS,
} from "@/lib/constants/constants";
import { setTokens, getTokens, deleteTokens } from "@/lib/keychain/keychain";
import type { ManualGameEntry } from "./store.types";

let store: Store | null = null;

const getStore = async (): Promise<Store> => {
  if (!store) {
    store = await load("qsave-data.json", { autoSave: true, defaults: {} });
  }
  return store;
};

// Auth — tokens go to OS keychain, non-sensitive metadata to JSON store
type StoredAuthMeta = {
  isAuthenticated: boolean;
  email?: string;
  expiresAt?: number;
};

export const getAuthState = async (): Promise<AuthState> => {
  try {
    const s = await getStore();
    const meta = await s.get<StoredAuthMeta>(STORE_KEYS.auth);
    if (!meta?.isAuthenticated) return { isAuthenticated: false };

    const tokens = await getTokens();
    return { ...meta, ...tokens };
  } catch {
    return { isAuthenticated: false };
  }
};

export const setAuthState = async (auth: AuthState): Promise<void> => {
  try {
    await setTokens(auth.accessToken, auth.refreshToken);

    const s = await getStore();
    const meta: StoredAuthMeta = {
      isAuthenticated: auth.isAuthenticated,
      email: auth.email,
      expiresAt: auth.expiresAt,
    };
    await s.set(STORE_KEYS.auth, meta);
  } catch {
    // store write failed — caller should handle auth state separately
  }
};

export const clearAuth = async (): Promise<void> => {
  try {
    await deleteTokens();
    const s = await getStore();
    await s.delete(STORE_KEYS.auth);
  } catch {
    // store delete failed — no-op
  }
};

// Sync history
export const getSyncHistory = async (): Promise<SyncRecord[]> => {
  try {
    const s = await getStore();
    const history = await s.get<SyncRecord[]>(STORE_KEYS.syncHistory);
    return history ?? [];
  } catch {
    return [];
  }
};

export const addSyncRecord = async (record: SyncRecord): Promise<void> => {
  try {
    const history = await getSyncHistory();
    history.unshift(record);
    if (history.length > MAX_SYNC_HISTORY_RECORDS)
      history.length = MAX_SYNC_HISTORY_RECORDS;
    const s = await getStore();
    await s.set(STORE_KEYS.syncHistory, history);
  } catch {
    // store write failed — sync record lost but not critical
  }
};

// Drive folder IDs cache
export const getDriveFolderId = async (
  gameName: string,
): Promise<string | undefined> => {
  try {
    const s = await getStore();
    const folders = await s.get<Record<string, string>>(
      STORE_KEYS.driveFolders,
    );
    return folders?.[gameName];
  } catch {
    return undefined;
  }
};

export const setDriveFolderId = async (
  gameName: string,
  folderId: string,
): Promise<void> => {
  try {
    const s = await getStore();
    const folders =
      (await s.get<Record<string, string>>(STORE_KEYS.driveFolders)) ?? {};
    folders[gameName] = folderId;
    await s.set(STORE_KEYS.driveFolders, folders);
  } catch {
    // store write failed — folder ID will be re-fetched next sync
  }
};

// Watched games
export const getWatchedGames = async (): Promise<string[]> => {
  try {
    const s = await getStore();
    return (await s.get<string[]>(STORE_KEYS.watchedGames)) ?? [];
  } catch {
    return [];
  }
};

export const setWatchedGames = async (names: string[]): Promise<void> => {
  try {
    const s = await getStore();
    await s.set(STORE_KEYS.watchedGames, names);
  } catch {
    // store write failed — watch preferences lost
  }
};

// Manual games
export type { ManualGameEntry } from "./store.types";

export const getManualGames = async (): Promise<ManualGameEntry[]> => {
  try {
    const s = await getStore();
    return (await s.get<ManualGameEntry[]>(STORE_KEYS.manualGames)) ?? [];
  } catch {
    return [];
  }
};

export const setManualGames = async (
  games: ManualGameEntry[],
): Promise<void> => {
  try {
    const s = await getStore();
    await s.set(STORE_KEYS.manualGames, games);
  } catch {
    // store write failed — manual games not persisted
  }
};

export const addManualGame = async (
  name: string,
  paths: string[],
): Promise<void> => {
  const games = await getManualGames();
  const existingIndex = games.findIndex((game) => game.name === name);
  if (existingIndex >= 0) {
    games[existingIndex] = { name, paths };
    return setManualGames(games);
  }
  games.push({ name, paths });
  await setManualGames(games);
};

export const removeManualGame = async (name: string): Promise<void> => {
  const games = await getManualGames();
  await setManualGames(games.filter((game) => game.name !== name));
};

// Preferences
export const getHideSteamCloud = async (): Promise<boolean> => {
  try {
    const s = await getStore();
    return (await s.get<boolean>(STORE_KEYS.hideSteamCloud)) ?? false;
  } catch {
    return false;
  }
};

export const setHideSteamCloud = async (value: boolean): Promise<void> => {
  try {
    const s = await getStore();
    await s.set(STORE_KEYS.hideSteamCloud, value);
  } catch {
    // store write failed — preference not persisted
  }
};

// Autostart preference
export const setAutostart = async (value: boolean): Promise<void> => {
  try {
    const s = await getStore();
    await s.set(STORE_KEYS.autostart, value);
  } catch {
    // store write failed — preference not persisted
  }
};

// Device ID
let fallbackDeviceId: string | null = null;

export const getDeviceId = async (): Promise<string> => {
  try {
    const s = await getStore();
    const existing = await s.get<string>(STORE_KEYS.deviceId);
    if (existing) return existing;

    const deviceId = crypto.randomUUID();
    await s.set(STORE_KEYS.deviceId, deviceId);
    return deviceId;
  } catch {
    if (!fallbackDeviceId) fallbackDeviceId = crypto.randomUUID();
    return fallbackDeviceId;
  }
};

// Sync fingerprints
export const getSyncFingerprints = async (): Promise<
  Record<string, GameSyncFingerprint>
> => {
  try {
    const s = await getStore();
    return (
      (await s.get<Record<string, GameSyncFingerprint>>(
        STORE_KEYS.syncFingerprints,
      )) ?? {}
    );
  } catch {
    return {};
  }
};

export const setSyncFingerprint = async (
  gameName: string,
  fingerprint: GameSyncFingerprint,
): Promise<void> => {
  try {
    const s = await getStore();
    const all =
      (await s.get<Record<string, GameSyncFingerprint>>(
        STORE_KEYS.syncFingerprints,
      )) ?? {};
    all[gameName] = fingerprint;
    await s.set(STORE_KEYS.syncFingerprints, all);
  } catch {
    // store write failed — fingerprint will be recalculated next sync
  }
};
