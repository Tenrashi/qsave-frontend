import { create } from "zustand";
import type { SyncStatus } from "@/domain/types";

type SyncStore = {
  gameStatuses: Record<string, SyncStatus>;
  setGameStatus: (gameName: string, status: SyncStatus) => void;
};

export const useSyncStore = create<SyncStore>((set) => ({
  gameStatuses: {},

  setGameStatus: (gameName, status) =>
    set((state) => ({ gameStatuses: { ...state.gameStatuses, [gameName]: status } })),
}));
