import { useMemo, useState, useEffect, useDeferredValue } from "react";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { useGames } from "@/hooks/queries/useGames/useGames";
import { useSyncHistory } from "@/hooks/queries/useSyncHistory/useSyncHistory";
// TODO: autosync is WIP — re-enable once stable
// import { useAutoSync } from "@/hooks/useAutoSync/useAutoSync";
import { useGameDetectionNotify } from "@/hooks/useGameDetectionNotify/useGameDetectionNotify";
import { useAppUpdate } from "@/hooks/useAppUpdate/useAppUpdate";
import type { Game } from "@/domain/types";
import {
  getHideSteamCloud,
  setHideSteamCloud as persistHideSteamCloud,
  setAutostart as persistAutostart,
} from "@/lib/store/store";
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { AppHeader } from "@/components/AppHeader/AppHeader";
import { AuthStatus } from "@/components/AuthStatus/AuthStatus";
import { GameToolbar } from "@/components/GameToolbar/GameToolbar";
import { GameListPanel } from "@/components/GameListPanel/GameListPanel";
import { SyncHistory } from "@/components/SyncHistory/SyncHistory";
import { StatusBar } from "@/components/StatusBar/StatusBar";
import { UpdateBanner } from "@/components/AppHeader/UpdateBanner/UpdateBanner";

const App = () => {
  const { init, auth } = useAuthStore();
  const {
    // initWatchPreferences,
    initSyncFingerprints,
    loadBackedUpGames,
    backedUpGames,
    backedUpGamesLoaded,
    // watchedGames,
    // setAllGamesWatched,
  } = useSyncStore();
  const games = useGames();
  const history = useSyncHistory();
  const [search, setSearch] = useState("");
  const [hideSteamCloud, setHideSteamCloud] = useState(false);
  const [autostart, setAutostart] = useState(false);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    init();
    // initWatchPreferences();
    initSyncFingerprints();
    getHideSteamCloud().then(setHideSteamCloud);
    isAutostartEnabled()
      .then(setAutostart)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (auth.isAuthenticated) {
      loadBackedUpGames();
    }
  }, [auth.isAuthenticated]);

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
    let result = allGames;
    if (hideSteamCloud) {
      result = result.filter((game) => !game.hasSteamCloud);
    }
    if (deferredSearch.trim()) {
      const query = deferredSearch.toLowerCase();
      result = result.filter((game) => game.name.toLowerCase().includes(query));
    }
    return result;
  }, [allGames, deferredSearch, hideSteamCloud]);

  // TODO: autosync is WIP — re-enable once stable
  // const watchableGameNames = useMemo(
  //   () =>
  //     filteredGames
  //       .filter((game) => !game.isCloudOnly)
  //       .map((game) => game.name),
  //   [filteredGames],
  // );

  // const watching =
  //   watchableGameNames.length > 0 &&
  //   watchableGameNames.every((name) => watchedGames[name]);

  const handleToggleAutostart = async () => {
    const next = !autostart;
    setAutostart(next);
    try {
      await (next ? enableAutostart() : disableAutostart());
      await persistAutostart(next);
    } catch {
      setAutostart(!next);
    }
  };

  // useAutoSync(games.data);
  useGameDetectionNotify(games.data);
  const appUpdate = useAppUpdate();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <AppHeader
        isFetching={games.isFetching}
        onRefresh={() => {
          games.refetch();
          if (auth.isAuthenticated) loadBackedUpGames(true);
        }}
      />
      {appUpdate.version &&
        (appUpdate.status === "available" ||
          appUpdate.status === "downloading" ||
          appUpdate.status === "installing") && (
          <UpdateBanner
            status={appUpdate.status}
            version={appUpdate.version}
            onInstall={appUpdate.install}
          />
        )}
      <AuthStatus />
      <GameToolbar
        search={search}
        onSearchChange={setSearch}
        hideSteamCloud={hideSteamCloud}
        onToggleHideSteamCloud={() =>
          setHideSteamCloud((prev) => {
            persistHideSteamCloud(!prev);
            return !prev;
          })
        }
      />
      <GameListPanel games={filteredGames} isLoading={games.isLoading} />
      {(history.data?.length ?? 0) > 0 && (
        <div className="border-t px-4 py-2">
          <SyncHistory />
        </div>
      )}
      <StatusBar
        games={games.data ?? []}
        // watching={watching}
        // onToggleWatching={() =>
        //   setAllGamesWatched(watchableGameNames, !watching)
        // }
        autostart={autostart}
        onToggleAutostart={handleToggleAutostart}
      />
    </div>
  );
};

export default App;
