import { useMemo, useState, useEffect, useDeferredValue } from "react";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { useGames } from "@/hooks/queries/useGames/useGames";
import { useSyncHistory } from "@/hooks/queries/useSyncHistory/useSyncHistory";
import { useAutoSync } from "@/hooks/useAutoSync/useAutoSync";
import { useGameDetectionNotify } from "@/hooks/useGameDetectionNotify/useGameDetectionNotify";
import type { Game } from "@/domain/types";
import { AppHeader } from "@/components/AppHeader/AppHeader";
import { AuthStatus } from "@/components/AuthStatus/AuthStatus";
import { GameToolbar } from "@/components/GameToolbar/GameToolbar";
import { ErrorBanner } from "@/components/ErrorBanner/ErrorBanner";
import { GameListPanel } from "@/components/GameListPanel/GameListPanel";
import { SyncHistory } from "@/components/SyncHistory/SyncHistory";
import { StatusBar } from "@/components/StatusBar/StatusBar";

const App = () => {
  const { init, auth } = useAuthStore();
  const {
    initWatchPreferences,
    initSyncFingerprints,
    loadBackedUpGames,
    backedUpGames,
    backedUpGamesLoaded,
  } = useSyncStore();
  const games = useGames();
  const history = useSyncHistory();
  const [search, setSearch] = useState("");
  const [watching, setWatching] = useState(true);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    init();
    initWatchPreferences();
    initSyncFingerprints();
  }, []);

  useEffect(() => {
    if (auth.isAuthenticated) {
      loadBackedUpGames();
    }
  }, [auth.isAuthenticated]);

  useAutoSync(games.data, watching);
  useGameDetectionNotify(games.data);

  const allGames = useMemo(() => {
    const localGames = games.data ?? [];
    if (!auth.isAuthenticated || !backedUpGamesLoaded) return localGames;

    const localNames = new Set(localGames.map((game) => game.name));
    const cloudOnlyGames: Game[] = [...backedUpGames]
      .filter((name) => !localNames.has(name))
      .map((name) => ({
        name,
        savePaths: [],
        saveFiles: [],
        isCloudOnly: true,
      }));

    return [...localGames, ...cloudOnlyGames].sort((gameA, gameB) =>
      gameA.name.localeCompare(gameB.name),
    );
  }, [games.data, auth.isAuthenticated, backedUpGames, backedUpGamesLoaded]);

  const filteredGames = useMemo(() => {
    if (!deferredSearch.trim()) return allGames;
    const query = deferredSearch.toLowerCase();
    return allGames.filter((game) => game.name.toLowerCase().includes(query));
  }, [allGames, deferredSearch]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <AppHeader
        isFetching={games.isFetching}
        onRefresh={() => {
          games.refetch();
          if (auth.isAuthenticated) loadBackedUpGames(true);
        }}
      />
      <AuthStatus />
      <GameToolbar search={search} onSearchChange={setSearch} />
      {games.error && <ErrorBanner message={games.error.message} />}
      <GameListPanel games={filteredGames} isLoading={games.isLoading} />
      {(history.data?.length ?? 0) > 0 && (
        <div className="border-t px-4 py-2">
          <SyncHistory />
        </div>
      )}
      <StatusBar
        games={games.data ?? []}
        watching={watching}
        onToggleWatching={() => setWatching((prev) => !prev)}
      />
    </div>
  );
};

export default App;
