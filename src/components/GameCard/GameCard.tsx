import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, CheckCircle, AlertCircle, Loader2, Gamepad2, FolderOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import type { Game, SyncStatus } from "@/domain/types";
import { syncGame } from "@/services/sync";
import { dateFnsLocales } from "@/lib/date-locales";
import { formatSize } from "./utils/formatSize";

const SyncStatusIcon = ({ status }: { status: SyncStatus }) => {
  switch (status) {
    case "syncing":
      return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
    case "success":
      return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
    case "error":
      return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
    default:
      return null;
  }
};

export type GameCardProps = {
  game: Game;
};

export const GameCard = memo(({ game }: GameCardProps) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { auth } = useAuthStore();
  const { gameStatuses, setGameStatus } = useSyncStore();
  const locale = dateFnsLocales[i18n.language] ?? enUS;

  const status = gameStatuses[game.name] ?? "idle";
  const isSyncing = status === "syncing";

  const totalSize = game.saveFiles.reduce((sum, f) => sum + f.sizeBytes, 0);
  const lastModified = game.saveFiles.reduce(
    (latest, f) => (f.lastModified > latest ? f.lastModified : latest),
    new Date(0),
  );

  const handleSync = async () => {
    setGameStatus(game.name, "syncing");
    try {
      const results = await syncGame(game);
      const hasError = results.some((r) => r.status === "error");
      setGameStatus(game.name, hasError ? "error" : "success");
    } catch {
      setGameStatus(game.name, "error");
    }
    queryClient.invalidateQueries({ queryKey: ["syncHistory"] });
  };

  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Gamepad2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="font-medium truncate">{game.name}</span>
          <SyncStatusIcon status={status} />
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="w-3 h-3" />
            <span>{formatSize(totalSize)}</span>
          </div>
          <span>{formatDistanceToNow(lastModified, { addSuffix: true, locale })}</span>
          {auth.isAuthenticated && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSync}
              disabled={isSyncing}
              className="ml-1"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Upload className="w-3.5 h-3.5 mr-1.5" />
              )}
              {t("games.sync")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
});
