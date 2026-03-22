import { create } from "zustand";
import type { SyncStatus, GameSyncFingerprint } from "@/domain/types";
import {
  getWatchedGames,
  setWatchedGames,
  getSyncFingerprints,
  setSyncFingerprint,
} from "@/lib/store/store";
import { listBackedUpGameNames } from "@/services/drive/drive";

type SyncStore = {
  gameStatuses: Record<string, SyncStatus>;
  setGameStatus: (gameName: string, status: SyncStatus) => void;

  watchedGames: Record<string, boolean>;
  initWatchPreferences: () => Promise<void>;
  toggleGameWatch: (gameName: string) => Promise<void>;
  isGameWatched: (gameName: string) => boolean;
  setAllGamesWatched: (gameNames: string[], watched: boolean) => Promise<void>;

  syncFingerprints: Record<string, GameSyncFingerprint>;
  initSyncFingerprints: () => Promise<void>;
  updateSyncFingerprint: (gameName: string, hash: string) => Promise<void>;

  backedUpGames: Set<string>;
  backedUpGamesLoaded: boolean;
  loadBackedUpGames: (force?: boolean) => Promise<void>;
  markGameBackedUp: (gameName: string) => void;
  hasBackup: (gameName: string) => boolean;
};

export const useSyncStore = create<SyncStore>((set, get) => ({
  gameStatuses: {},
  watchedGames: {},
  syncFingerprints: {},
  backedUpGames: new Set<string>(),
  backedUpGamesLoaded: false,

  setGameStatus: (gameName, status) =>
    set((state) => ({
      gameStatuses: { ...state.gameStatuses, [gameName]: status },
    })),

  initWatchPreferences: async () => {
    const names = await getWatchedGames();
    const map: Record<string, boolean> = {};
    for (const name of names) {
      map[name] = true;
    }
    set({ watchedGames: map });
  },

  toggleGameWatch: async (gameName) => {
    const current = get().watchedGames[gameName] ?? false;
    const updated = { ...get().watchedGames, [gameName]: !current };
    set({ watchedGames: updated });
    const names = Object.entries(updated)
      .filter(([, v]) => v)
      .map(([k]) => k);
    await setWatchedGames(names);
  },

  isGameWatched: (gameName) => get().watchedGames[gameName] ?? false,

  setAllGamesWatched: async (gameNames, watched) => {
    const updated: Record<string, boolean> = {};
    for (const name of gameNames) {
      updated[name] = watched;
    }
    set({ watchedGames: updated });
    const names = watched ? gameNames : [];
    await setWatchedGames(names);
  },

  initSyncFingerprints: async () => {
    const fingerprints = await getSyncFingerprints();
    set({ syncFingerprints: fingerprints });
  },

  loadBackedUpGames: async (force = false) => {
    if (!force && get().backedUpGamesLoaded) return;
    const names = await listBackedUpGameNames();
    set({ backedUpGames: new Set(names), backedUpGamesLoaded: true });
  },

  markGameBackedUp: (gameName) => {
    const updated = new Set(get().backedUpGames);
    updated.add(gameName);
    set({ backedUpGames: updated });
  },

  hasBackup: (gameName) => get().backedUpGames.has(gameName),

  updateSyncFingerprint: async (gameName, hash) => {
    const fingerprint: GameSyncFingerprint = {
      hash,
      syncedAt: new Date().toISOString(),
    };
    set((state) => ({
      syncFingerprints: { ...state.syncFingerprints, [gameName]: fingerprint },
    }));
    await setSyncFingerprint(gameName, fingerprint);
  },
}));
