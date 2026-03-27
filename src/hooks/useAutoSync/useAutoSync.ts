import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SYNC_STATUS } from "@/domain/types";
import type { Game } from "@/domain/types";
import { QUERY_KEYS } from "@/lib/constants/constants";
import { useSyncStore } from "@/stores/sync";
import { useAuthStore } from "@/stores/auth";
import { startWatching, stopWatching } from "@/lib/watcher/watcher";
import { scheduleAutoSync, cancelAllAutoSyncs } from "@/lib/autoSync/autoSync";
import { computeContentHash } from "@/lib/hash/hash";
import { syncGame } from "@/operations/sync/sync/sync";
import { rescanGame } from "@/operations/scanner/scanner/scanner";

export const useAutoSync = (games: Game[] | undefined): void => {
  const queryClient = useQueryClient();
  const gamesRef = useRef<Game[]>([]);
  gamesRef.current = games ?? [];

  const {
    isGameWatched,
    watchedGames,
    gameStatuses,
    setGameStatus,
    syncFingerprints,
    updateSyncFingerprint,
  } = useSyncStore();
  const { auth } = useAuthStore();

  // Keep refs to avoid stale closures in the watcher callback
  const storeRef = useRef({
    isGameWatched,
    gameStatuses,
    syncFingerprints,
    setGameStatus,
    updateSyncFingerprint,
    auth,
  });
  storeRef.current = {
    isGameWatched,
    gameStatuses,
    syncFingerprints,
    setGameStatus,
    updateSyncFingerprint,
    auth,
  };

  // Cancel everything on unmount only (not on dep changes)
  useEffect(() => () => cancelAllAutoSyncs(), []);

  useEffect(() => {
    const watchedList = (games ?? []).filter(
      (game) => game.savePaths.length > 0 && watchedGames[game.name],
    );

    if (watchedList.length === 0) {
      stopWatching();
      cancelAllAutoSyncs();
      return;
    }

    // Build dir -> gameName lookup for watched games only
    const dirToGame = new Map<string, string>();
    for (const game of watchedList) {
      for (const dir of game.savePaths) {
        dirToGame.set(dir, game.name);
      }
    }

    const dirs = watchedList.flatMap((game) => game.savePaths);

    startWatching(dirs, (changedPaths) => {
      // Find which games were affected
      const affectedGames = new Set<string>();
      for (const changed of changedPaths) {
        for (const [dir, gameName] of dirToGame) {
          if (!changed.startsWith(dir)) continue;
          affectedGames.add(gameName);
        }
      }

      // Rescan only affected games and update cache
      for (const gameName of affectedGames) {
        const game = gamesRef.current.find((game) => game.name === gameName);
        if (!game) continue;

        rescanGame(game).then((updated) => {
          gamesRef.current = gamesRef.current.map((game) =>
            game.name === gameName ? updated : game,
          );
          queryClient.setQueryData<Game[]>(QUERY_KEYS.games, (prev = []) =>
            prev.map((game) => (game.name === gameName ? updated : game)),
          );
        });

        const store = storeRef.current;
        if (!store.auth.isAuthenticated) continue;
        if (store.gameStatuses[gameName] === SYNC_STATUS.syncing) continue;

        scheduleAutoSync(gameName, async () => {
          const currentGame = gamesRef.current.find(
            (game) => game.name === gameName,
          );
          if (!currentGame) return;

          const currentStore = storeRef.current;

          try {
            const filePaths = currentGame.saveFiles.map((file) => file.path);
            const hash = await computeContentHash(
              currentGame.savePaths,
              filePaths,
            );
            const existing = currentStore.syncFingerprints[gameName];
            if (existing?.hash === hash) return;

            currentStore.setGameStatus(gameName, SYNC_STATUS.syncing);
            const record = await syncGame(currentGame);
            const status =
              record.status === SYNC_STATUS.error
                ? SYNC_STATUS.error
                : SYNC_STATUS.success;
            currentStore.setGameStatus(gameName, status);
            if (status === SYNC_STATUS.success && record.contentHash) {
              currentStore.updateSyncFingerprint(gameName, record.contentHash);
            }
            queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.syncHistory,
            });
          } catch {
            currentStore.setGameStatus(gameName, SYNC_STATUS.error);
          }
        });
      }
    });

    return () => {
      stopWatching();
    };
  }, [watchedGames, games]);
};
