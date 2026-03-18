import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SYNC_STATUS } from "@/domain/types";
import type { Game } from "@/domain/types";
import { QUERY_KEYS } from "@/lib/constants";
import { useSyncStore } from "@/stores/sync";
import { useAuthStore } from "@/stores/auth";
import { startWatching, stopWatching } from "@/lib/watcher";
import { scheduleAutoSync, cancelAllAutoSyncs } from "@/lib/autoSync";
import { computeGameHash } from "@/lib/hash";
import { syncGame } from "@/services/sync";
import { rescanGame } from "@/services/scanner";

export const useAutoSync = (
  games: Game[] | undefined,
  globalWatchEnabled: boolean,
): void => {
  const queryClient = useQueryClient();
  const gamesRef = useRef<Game[]>([]);
  gamesRef.current = games ?? [];

  const {
    isGameWatched,
    gameStatuses,
    setGameStatus,
    syncFingerprints,
    updateSyncFingerprint,
  } = useSyncStore();
  const { auth } = useAuthStore();

  // Keep refs to avoid stale closures in the watcher callback
  const storeRef = useRef({ isGameWatched, gameStatuses, syncFingerprints, setGameStatus, updateSyncFingerprint, auth });
  storeRef.current = { isGameWatched, gameStatuses, syncFingerprints, setGameStatus, updateSyncFingerprint, auth };

  useEffect(() => {
    if (!globalWatchEnabled || !games?.length) {
      stopWatching();
      cancelAllAutoSyncs();
      return;
    }

    // Build dir -> gameName lookup
    const dirToGame = new Map<string, string>();
    for (const game of games) {
      for (const dir of game.savePaths) {
        dirToGame.set(dir, game.name);
      }
    }

    const dirs = games.flatMap((g) => g.savePaths);

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
        if (!store.isGameWatched(gameName)) continue;
        if (store.gameStatuses[gameName] === SYNC_STATUS.syncing) continue;

        scheduleAutoSync(gameName, () => {
          const currentGame = gamesRef.current.find((game) => game.name === gameName);
          if (!currentGame) return;

          const currentStore = storeRef.current;
          const hash = computeGameHash(currentGame.saveFiles);
          const existing = currentStore.syncFingerprints[gameName];
          if (existing?.hash === hash) return;

          currentStore.setGameStatus(gameName, SYNC_STATUS.syncing);
          syncGame(currentGame)
            .then((record) => {
              const status = record.status === SYNC_STATUS.error ? SYNC_STATUS.error : SYNC_STATUS.success;
              currentStore.setGameStatus(gameName, status);
              if (status === SYNC_STATUS.success) {
                currentStore.updateSyncFingerprint(gameName, hash);
              }
              queryClient.invalidateQueries({ queryKey: QUERY_KEYS.syncHistory });
            })
            .catch(() => {
              currentStore.setGameStatus(gameName, SYNC_STATUS.error);
            });
        });
      }
    });

    return () => {
      stopWatching();
      cancelAllAutoSyncs();
    };
  }, [globalWatchEnabled, games]);
};
