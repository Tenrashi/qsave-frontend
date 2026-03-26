import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Download,
  ChevronDown,
  Loader2,
  FolderOpen,
  // TODO: autosync is WIP — uncomment when re-enabling
  // Eye,
  // EyeOff,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { SYNC_STATUS } from "@/domain/types";
import type { Game } from "@/domain/types";
import { QUERY_KEYS } from "@/lib/constants/constants";
import { syncGame } from "@/operations/sync/sync/sync";
import { computeGameHash } from "@/lib/hash/hash";
import { removeManualGame } from "@/lib/store/store";
import { useAuthStore } from "@/stores/auth";
import { useSyncStore } from "@/stores/sync";
import { dateFnsLocales } from "@/lib/date-locales/date-locales";
import { RemoveGameDialog } from "../RemoveGameDialog/RemoveGameDialog";
import { RestoreDialog } from "../RestoreDialog/RestoreDialog";
import { formatSize } from "../utils/formatSize";

export type LocalGameActionsProps = {
  game: Game;
};

export const LocalGameActions = ({ game }: LocalGameActionsProps) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { auth } = useAuthStore();
  const {
    gameStatuses,
    setGameStatus,
    syncFingerprints,
    updateSyncFingerprint,
    markGameBackedUp,
    // isGameWatched,
    // toggleGameWatch,
    hasBackup,
  } = useSyncStore();
  const locale = dateFnsLocales[i18n.language] ?? enUS;

  const status = gameStatuses[game.name] ?? SYNC_STATUS.idle;
  const isBusy =
    status === SYNC_STATUS.syncing || status === SYNC_STATUS.restoring;
  // const watched = isGameWatched(game.name);
  const currentHash = computeGameHash(game.saveFiles, game.savePaths);
  const isSynced =
    syncFingerprints[game.name]?.hash === currentHash && hasBackup(game.name);

  const totalSize = game.saveFiles.reduce(
    (sum, file) => sum + file.sizeBytes,
    0,
  );
  const lastModified = game.saveFiles.reduce(
    (latest, file) => (file.lastModified > latest ? file.lastModified : latest),
    new Date(0),
  );

  const handleRemove = async () => {
    try {
      await removeManualGame(game.name);
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.games });
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
      const newStatus =
        result.status === SYNC_STATUS.error
          ? SYNC_STATUS.error
          : SYNC_STATUS.success;
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
    <>
      <div className="flex items-center gap-1.5">
        <FolderOpen className="w-3 h-3" />
        <span>{formatSize(totalSize)}</span>
      </div>
      {game.saveFiles.length > 0 && (
        <span>
          {formatDistanceToNow(lastModified, { addSuffix: true, locale })}
        </span>
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
          {/* TODO: autosync is WIP — uncomment when re-enabling
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label={
                    watched
                      ? t("games.unwatchTooltip")
                      : t("games.watchTooltip")
                  }
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
          */}
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
            disabled={isBusy || isSynced}
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
    </>
  );
};
