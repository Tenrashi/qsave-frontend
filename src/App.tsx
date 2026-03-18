import { useMemo, useState, useEffect, useDeferredValue } from "react";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { useGames } from "@/hooks/useGames";
import { useSyncHistory } from "@/hooks/useSyncHistory";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useGameDetectionNotify } from "@/hooks/useGameDetectionNotify";
import { AppHeader } from "@/components/AppHeader/AppHeader";
import { AuthStatus } from "@/components/AuthStatus/AuthStatus";
import { GameToolbar } from "@/components/GameToolbar/GameToolbar";
import { ErrorBanner } from "@/components/ErrorBanner/ErrorBanner";
import { GameListPanel } from "@/components/GameListPanel/GameListPanel";
import { SyncHistory } from "@/components/SyncHistory/SyncHistory";
import { StatusBar } from "@/components/StatusBar/StatusBar";

const App = () => {
  const { init } = useAuthStore();
  const { initWatchPreferences, initSyncFingerprints } = useSyncStore();
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

  useAutoSync(games.data, watching);
  useGameDetectionNotify(games.data);

  const filteredGames = useMemo(() => {
    if (!games.data) return [];
    if (!deferredSearch.trim()) return games.data;
    const query = deferredSearch.toLowerCase();
    return games.data.filter((game) => game.name.toLowerCase().includes(query));
  }, [games.data, deferredSearch]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <AppHeader isFetching={games.isFetching} onRefresh={() => games.refetch()} />
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
