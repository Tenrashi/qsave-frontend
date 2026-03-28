import { useQueryClient } from "@tanstack/react-query";
import type { Game } from "@/domain/types";
import { SYNC_STATUS } from "@/domain/types";
import { QUERY_KEYS } from "@/lib/constants/constants";
import { syncGame, type SyncResult } from "@/operations/sync/sync/sync";
import { useSyncStore } from "@/stores/sync";

export const useSyncAndUpdate = (): ((game: Game) => Promise<SyncResult>) => {
  const queryClient = useQueryClient();

  return async (game: Game) => {
    const { setGameStatus, updateSyncFingerprint, markGameBackedUp } =
      useSyncStore.getState();
    setGameStatus(game.name, SYNC_STATUS.syncing);
    try {
      const result = await syncGame(game);
      const status =
        result.status === SYNC_STATUS.error
          ? SYNC_STATUS.error
          : SYNC_STATUS.success;
      setGameStatus(game.name, status);
      if (status === SYNC_STATUS.success) {
        markGameBackedUp(game.name);
        if (result.contentHash) {
          await updateSyncFingerprint(game.name, result.contentHash);
        }
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.syncHistory });
      return result;
    } catch (error) {
      useSyncStore.getState().setGameStatus(game.name, SYNC_STATUS.error);
      throw error;
    }
  };
};
