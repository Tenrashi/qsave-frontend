import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Download, FolderOpen, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import type { Game, DriveBackup } from "@/domain/types";
import { TAURI_COMMANDS } from "@/lib/constants/constants";
import { computeContentHash } from "@/lib/hash/hash";
import { getDeviceId } from "@/lib/store/store";
import {
  findDeviceGamePaths,
  getCloudGameHash,
} from "@/operations/devices/devices";
import { useSyncStore } from "@/stores/sync";
import { useSyncAndUpdate } from "@/hooks/useSyncAndUpdate/useSyncAndUpdate";
import { useGameBackups } from "@/hooks/queries/useGameBackups/useGameBackups";
import { useRestoreBackup } from "@/hooks/mutations/useRestoreBackup/useRestoreBackup";
import { useDeleteBackup } from "@/hooks/mutations/useDeleteBackup/useDeleteBackup";
import { StatusMessage } from "@/components/ui/status-message";
import { QuickWarning } from "./QuickWarning/QuickWarning";
import { ConflictWarning } from "./ConflictWarning/ConflictWarning";
import { BackupsSkeleton } from "./BackupsSkeleton/BackupsSkeleton";
import { EmptyBackups } from "./EmptyBackups/EmptyBackups";
import { BackupList } from "./BackupList/BackupList";

export type RestoreBodyProps = {
  game: Game;
  quick?: boolean;
  open: boolean;
};

export const RestoreBody = ({ game, quick, open }: RestoreBodyProps) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<DriveBackup>();
  const [targetPath, setTargetPath] = useState<string>();
  const [showConflict, setShowConflict] = useState(false);
  const [conflictConfirmed, setConflictConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { syncFingerprints } = useSyncStore();
  const syncAndUpdate = useSyncAndUpdate();

  const backupsQuery = useGameBackups(game.name, open && !quick);
  const restoreMutation = useRestoreBackup(game);
  const deleteMutation = useDeleteBackup(game.name, () =>
    setSelected(undefined),
  );

  useEffect(() => {
    if (open) return;
    setSelected(undefined);
    setTargetPath(undefined);
    setShowConflict(false);
    setConflictConfirmed(false);
    setUploading(false);
    restoreMutation.reset();
    deleteMutation.reset();
  }, [open]);

  useEffect(() => {
    if (!open || !game.isCloudOnly) return;

    const loadDevicePath = async () => {
      try {
        const deviceId = await getDeviceId();
        const paths = await findDeviceGamePaths(deviceId, game.name);
        if (paths?.[0]) setTargetPath(paths[0]);
      } catch (error) {
        console.warn("Failed to load device path:", error);
      }
    };

    loadDevicePath();
  }, [open, game.isCloudOnly, game.name]);

  const handlePickFolder = async () => {
    try {
      const folder = await invoke<string | null>(TAURI_COMMANDS.pickFolder);
      if (folder) setTargetPath(folder);
    } catch (error) {
      console.error("Folder picker failed:", error);
    }
  };

  const canRestore =
    restoreMutation.isIdle &&
    (quick || selected !== undefined || showConflict) &&
    (!game.isCloudOnly || targetPath !== undefined);

  const handleRestore = async () => {
    if (!conflictConfirmed && !game.isCloudOnly) {
      const fingerprint = syncFingerprints[game.name];
      if (fingerprint) {
        try {
          const filePaths = game.saveFiles.map((file) => file.path);
          const localHash = await computeContentHash(game.savePaths, filePaths);
          const cloudHash = await getCloudGameHash(game.name);
          const localDiverged = localHash !== fingerprint.hash;
          const cloudDiffers = cloudHash && cloudHash.hash !== localHash;
          if (localDiverged && cloudDiffers) {
            setShowConflict(true);
            return;
          }
        } catch {
          // If hash computation fails, proceed without conflict check
        }
      }
    }
    const targetPaths = targetPath ? [targetPath] : undefined;
    restoreMutation.mutate({ backupId: selected?.id, targetPaths });
  };

  const handleRestoreAnyway = () => {
    setConflictConfirmed(true);
    setShowConflict(false);
    const targetPaths = targetPath ? [targetPath] : undefined;
    restoreMutation.mutate({ backupId: selected?.id, targetPaths });
  };

  const handleUploadFirst = async () => {
    setUploading(true);
    try {
      await syncAndUpdate(game);
      setShowConflict(false);
      setUploading(false);
    } catch {
      setUploading(false);
    }
  };

  const resolveErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  const renderBody = () => {
    if (restoreMutation.isPending)
      return (
        <StatusMessage variant="pending" message={t("restore.restoring")} />
      );
    if (restoreMutation.isSuccess)
      return (
        <StatusMessage
          variant="success"
          message={t("restore.success", {
            count: restoreMutation.data.revisionCount,
          })}
        />
      );
    if (restoreMutation.isError)
      return (
        <StatusMessage
          variant="error"
          message={resolveErrorMessage(
            restoreMutation.error,
            t("restore.error"),
          )}
        />
      );
    if (deleteMutation.isPending)
      return (
        <StatusMessage variant="pending" message={t("restore.deleting")} />
      );
    if (deleteMutation.isSuccess)
      return (
        <StatusMessage variant="success" message={t("restore.deleteSuccess")} />
      );
    if (deleteMutation.isError)
      return (
        <StatusMessage
          variant="error"
          message={resolveErrorMessage(
            deleteMutation.error,
            t("restore.deleteError"),
          )}
        />
      );
    if (showConflict) return <ConflictWarning />;
    if (quick) return <QuickWarning />;
    if (backupsQuery.isLoading) return <BackupsSkeleton />;
    if (backupsQuery.isError)
      return (
        <StatusMessage
          variant="error"
          message={resolveErrorMessage(backupsQuery.error, t("restore.error"))}
        />
      );

    const backups = backupsQuery.data ?? [];
    if (backups.length === 0) return <EmptyBackups />;

    return (
      <BackupList
        backups={backups}
        selected={selected}
        onSelect={setSelected}
        onDelete={(backupId) => deleteMutation.mutate(backupId)}
      />
    );
  };

  return (
    <>
      {game.isCloudOnly && (
        <button
          type="button"
          className="flex items-center gap-2 mb-2 p-2 rounded-md bg-muted text-sm w-full text-left cursor-pointer hover:bg-muted/80 transition-colors"
          onClick={handlePickFolder}
        >
          <FolderOpen className="w-4 h-4 shrink-0 text-muted-foreground" />
          {targetPath ? (
            <>
              <span className="truncate flex-1" title={targetPath}>
                {targetPath}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("restore.changePath")}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {t("restore.pickFolder")}
            </span>
          )}
        </button>
      )}
      <div className={`space-y-2${showConflict ? "" : " min-h-[60px]"}`}>
        {renderBody()}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <DialogClose render={<Button variant="ghost" />}>
          {t("restore.close")}
        </DialogClose>
        {showConflict && (
          <>
            <Button
              variant="ghost"
              onClick={handleRestoreAnyway}
              disabled={uploading}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {t("restore.restoreAnyway")}
            </Button>
            <Button onClick={handleUploadFirst} disabled={uploading}>
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Upload className="w-3.5 h-3.5 mr-1.5" />
              )}
              {t("restore.uploadFirst")}
            </Button>
          </>
        )}
        {!showConflict && canRestore && (
          <Button onClick={handleRestore}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {t("restore.restore")}
          </Button>
        )}
      </div>
    </>
  );
};
