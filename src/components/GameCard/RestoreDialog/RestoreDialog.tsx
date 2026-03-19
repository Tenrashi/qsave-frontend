import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Download, CheckCircle, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Game, DriveBackup } from "@/domain/types";
import { SYNC_STATUS, RECORD_STATUS } from "@/domain/types";
import { QUERY_KEYS } from "@/lib/constants/constants";
import { listGameBackups } from "@/services/drive/drive";
import { restoreGame } from "@/services/restore/restore";
import { useSyncStore } from "@/stores/sync";
import { computeGameHash } from "@/lib/hash/hash";
import { dateFnsLocales } from "@/lib/date-locales/date-locales";
import type { RestoreState } from "./RestoreDialog.types";

export type RestoreDialogProps = {
  game: Game;
  trigger: React.ReactElement;
  quick?: boolean;
};

export const RestoreDialog = ({ game, trigger, quick }: RestoreDialogProps) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { setGameStatus, updateSyncFingerprint } = useSyncStore();
  const locale = dateFnsLocales[i18n.language] ?? enUS;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<RestoreState>({ step: "loading" });

  useEffect(() => {
    if (!open) return;

    if (quick) {
      setState({ step: "confirm" });
      return;
    }

    setState({ step: "loading" });
    listGameBackups(game.name)
      .then((backups) => setState({ step: "select", backups }))
      .catch((error) =>
        setState({
          step: "error",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
  }, [open, game.name, quick]);

  const handleSelect = (backup: DriveBackup) => {
    if (state.step !== "select") return;
    setState({ ...state, selected: backup });
  };

  const handleRestore = async (backupId?: string) => {
    setState({ step: "restoring" });
    setGameStatus(game.name, SYNC_STATUS.restoring);

    let resolvedId = backupId;
    if (!resolvedId) {
      try {
        const backups = await listGameBackups(game.name);
        resolvedId = backups[0]?.id;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState({ step: "error", message });
        setGameStatus(game.name, SYNC_STATUS.error);
        return;
      }
      if (!resolvedId) {
        setState({ step: "error", message: t("restore.noBackups") });
        setGameStatus(game.name, SYNC_STATUS.error);
        return;
      }
    }

    const result = await restoreGame(game, resolvedId);

    if (result.status === RECORD_STATUS.success) {
      setState({ step: "success", fileCount: result.revisionCount });
      setGameStatus(game.name, SYNC_STATUS.success);
      const newHash = computeGameHash(game.saveFiles);
      await updateSyncFingerprint(game.name, newHash);
    } else {
      setState({ step: "error", message: result.error ?? t("restore.error") });
      setGameStatus(game.name, SYNC_STATUS.error);
    }

    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.syncHistory });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.games });
  };

  const canRestore = state.step === "confirm" || (state.step === "select" && state.selected);

  const title = quick
    ? t("restore.confirmTitle")
    : t("restore.title", { name: game.name });

  const description = quick ? undefined : t("restore.selectBackup");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />

      <DialogPopup className="max-w-md">
        <DialogTitle className="mb-1">{title}</DialogTitle>
        {description && (
          <DialogDescription className="mb-4">{description}</DialogDescription>
        )}

        <div className="space-y-2 min-h-[60px]">
          {state.step === "loading" && (
            <div className="space-y-2">
              {Array.from({ length: quick ? 1 : 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          )}

          {state.step === "confirm" && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {t("restore.warning")}
            </p>
          )}

          {state.step === "select" && state.backups.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("restore.noBackups")}
            </p>
          )}

          {state.step === "select" && state.backups.length > 0 && (
            <>
              <ul className="space-y-1">
                {state.backups.map((backup) => {
                  const isSelected = state.selected?.id === backup.id;
                  return (
                    <li key={backup.id}>
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          isSelected
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted border border-transparent"
                        }`}
                        onClick={() => handleSelect(backup)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {formatDistanceToNow(new Date(backup.createdTime), {
                              addSuffix: true,
                              locale,
                            })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(backup.createdTime).toLocaleDateString(
                              i18n.language,
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {state.selected && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  {t("restore.warning")}
                </p>
              )}
            </>
          )}

          {state.step === "restoring" && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">{t("restore.restoring")}</span>
            </div>
          )}

          {state.step === "success" && (
            <div className="flex items-center justify-center gap-2 py-4 text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">
                {t("restore.success", { count: state.fileCount })}
              </span>
            </div>
          )}

          {state.step === "error" && (
            <div className="flex items-center justify-center gap-2 py-4 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{state.message}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <DialogClose render={<Button variant="ghost" />}>
            {t("restore.close")}
          </DialogClose>
          {canRestore && (
            <Button onClick={() => handleRestore(state.step === "select" ? state.selected?.id : undefined)}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {t("restore.restore")}
            </Button>
          )}
        </div>
      </DialogPopup>
    </Dialog>
  );
};
