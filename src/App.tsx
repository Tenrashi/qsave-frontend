import { useMemo, useState, useEffect, useRef, useDeferredValue } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth";
import { useGames } from "@/hooks/useGames";
import { useSyncHistory } from "@/hooks/useSyncHistory";
import { AuthStatus } from "@/components/AuthStatus/AuthStatus";
import { SearchBar } from "@/components/SearchBar/SearchBar";
import { SavesList } from "@/components/SavesList/SavesList";
import { SyncHistory } from "@/components/SyncHistory/SyncHistory";
import { StatusBar } from "@/components/StatusBar/StatusBar";
import { LanguageSelector } from "@/components/LanguageSelector/LanguageSelector";
import { startWatching, stopWatching } from "@/lib/watcher";

const App = () => {
  const { t } = useTranslation();
  const { init } = useAuthStore();
  const games = useGames();
  const history = useSyncHistory();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    if (!games.data?.length) return;
    const dirs = games.data.flatMap((g) => g.savePaths);
    startWatching(dirs, () => games.refetch());
    return () => { stopWatching(); };
  }, [games.data]);

  const filteredGames = useMemo(() => {
    if (!games.data) return [];
    if (!deferredSearch.trim()) return games.data;
    const query = deferredSearch.toLowerCase();
    return games.data.filter((g) => g.name.toLowerCase().includes(query));
  }, [games.data, deferredSearch]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-lg font-bold tracking-tight">QSave</h1>
        <div className="flex items-center gap-1">
          <LanguageSelector />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => games.refetch()}
            disabled={games.isFetching}
            title={t("app.refresh")}
          >
            <RefreshCw className={`w-4 h-4 ${games.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <AuthStatus />

      <div className="px-4 pt-4 pb-2">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {games.error && (
        <div className="mx-4 mb-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {games.error.message}
        </div>
      )}

      <ScrollArea className="flex-1 overflow-hidden" viewportRef={scrollRef}>
        <div className="px-4 pb-4">
          {games.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">{t("games.scanning")}</span>
            </div>
          ) : (
            <SavesList games={filteredGames} scrollRef={scrollRef} />
          )}
        </div>
      </ScrollArea>

      {(history.data?.length ?? 0) > 0 && (
        <div className="border-t">
          <div className="px-4 py-3">
            <SyncHistory />
          </div>
        </div>
      )}

      <StatusBar games={games.data ?? []} watchedCount={games.data?.length ?? 0} />
    </div>
  );
};

export default App;
