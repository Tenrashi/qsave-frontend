import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Download, ChevronDown, CheckCircle, AlertCircle, Loader2, FolderOpen, Eye, EyeOff, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { SYNC_STATUS } from "@/domain/types";
import type { Game, SyncStatus } from "@/domain/types";
import { QUERY_KEYS } from "@/lib/constants/constants";
import { syncGame } from "@/services/sync/sync";
import { computeGameHash } from "@/lib/hash/hash";
import { dateFnsLocales } from "@/lib/date-locales/date-locales";
import { removeManualGame } from "@/lib/store/store";
import { GameBanner } from "./GameBanner/GameBanner";
import { RemoveGameDialog } from "./RemoveGameDialog/RemoveGameDialog";
import { RestoreDialog } from "./RestoreDialog/RestoreDialog";
import { formatSize } from "./utils/formatSize";

const SyncStatusIcon = ({ status, isSynced }: { status: SyncStatus; isSynced: boolean }) => {
  if (status === SYNC_STATUS.syncing) return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" role="img" aria-label="syncing" aria-hidden={false} />;
  if (status === SYNC_STATUS.restoring) return <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" role="img" aria-label="restoring" aria-hidden={false} />;
  if (status === SYNC_STATUS.error) return <AlertCircle className="w-3.5 h-3.5 text-destructive" role="img" aria-label="sync error" aria-hidden={false} />;
  if (isSynced) return <CheckCircle className="w-3.5 h-3.5 text-green-500" role="img" aria-label="synced" aria-hidden={false} />;
  return null;
};

export type GameCardProps = {
  game: Game;
};

export const GameCard = memo(({ game }: GameCardProps) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { auth } = useAuthStore();
  const {
    gameStatuses,
    setGameStatus,
    isGameWatched,
    toggleGameWatch,
    syncFingerprints,
    updateSyncFingerprint,
    hasBackup,
    markGameBackedUp,
  } = useSyncStore();
  const locale = dateFnsLocales[i18n.language] ?? enUS;
  const status = gameStatuses[game.name] ?? SYNC_STATUS.idle;
  const isBusy = status === SYNC_STATUS.syncing || status === SYNC_STATUS.restoring;
  const watched = isGameWatched(game.name);

  const currentHash = computeGameHash(game.saveFiles);
  const isSynced = syncFingerprints[game.name]?.hash === currentHash;

  const totalSize = game.saveFiles.reduce((sum, f) => sum + f.sizeBytes, 0);
  const lastModified = game.saveFiles.reduce(
    (latest, f) => (f.lastModified > latest ? f.lastModified : latest),
    new Date(0),
  );

  const handleRemove = async () => {
    try {
      await removeManualGame(game.name);
      queryClient.setQueryData<Game[]>(QUERY_KEYS.games, (prev = []) =>
        prev.filter((existing) => existing.name !== game.name),
      );
    } catch {
      // store write failed — ignore
    }
  };

  const handleSync = async () => {
    setGameStatus(game.name, SYNC_STATUS.syncing);
    try {
      const result = await syncGame(game);
      const newStatus = result.status === SYNC_STATUS.error ? SYNC_STATUS.error : SYNC_STATUS.success;
      setGameStatus(game.name, newStatus);
      if (newStatus === SYNC_STATUS.success) {
        await updateSyncFingerprint(game.name, currentHash);
        markGameBackedUp(game.name);
      }
    } catch {
      setGameStatus(game.name, SYNC_STATUS.error);
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.syncHistory });
  };

  return (
    <Card className="overflow-hidden !py-0">
      <div className="flex items-center h-14">
        <GameBanner steamId={game.steamId} />
        <div className="flex items-center justify-between flex-1 min-w-0 pl-2 pr-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="font-medium truncate">{game.name}</span>
            <SyncStatusIcon status={status} isSynced={isSynced} />
            {game.isManual && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                {t("games.manualBadge")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-3 h-3" />
              <span>{formatSize(totalSize)}</span>
            </div>
            {game.saveFiles.length > 0 && (
              <span>{formatDistanceToNow(lastModified, { addSuffix: true, locale })}</span>
            )}
            {game.isManual && (
              <Tooltip>
                <RemoveGameDialog
                  onConfirm={handleRemove}
                  trigger={
                    <TooltipTrigger
                      render={
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label={t("games.removeGame")}
                        />
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </TooltipTrigger>
                  }
                />
                <TooltipContent>{t("games.removeGame")}</TooltipContent>
              </Tooltip>
            )}
            {auth.isAuthenticated && (
              <>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={watched ? t("games.unwatchTooltip") : t("games.watchTooltip")}
                        onClick={() => toggleGameWatch(game.name)}
                      />
                    }
                  >
                    {watched ? (
                      <Eye className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {watched ? t("games.unwatchTooltip") : t("games.watchTooltip")}
                  </TooltipContent>
                </Tooltip>
                {hasBackup(game.name) && (
                  <div className="flex items-center">
                    <RestoreDialog
                      game={game}
                      quick
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-r-none border-r-0 h-7 px-2"
                          disabled={isBusy}
                          aria-label={t("restore.tooltip")}
                        >
                          {status === SYNC_STATUS.restoring ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 text-orange-500" />
                          ) : (
                            <Download className="w-3.5 h-3.5 mr-1.5 text-orange-500" />
                          )}
                          {t("restore.restore")}
                        </Button>
                      }
                    />
                    <RestoreDialog
                      game={game}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-l-none h-7 px-1"
                          disabled={isBusy}
                          aria-label={t("restore.tooltipPick")}
                        >
                          <ChevronDown className="w-3 h-3 text-orange-500" />
                        </Button>
                      }
                    />
                  </div>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSync}
                  disabled={isBusy}
                >
                  {status === SYNC_STATUS.syncing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                  )}
                  {t("games.sync")}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});
