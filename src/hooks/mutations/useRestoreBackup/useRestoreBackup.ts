import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Game } from "@/domain/types";
import { SYNC_STATUS, RECORD_STATUS } from "@/domain/types";
import { QUERY_KEYS } from "@/lib/constants/constants";
import { listGameBackups } from "@/operations/drive/backups/backups";
import { saveDeviceSync } from "@/operations/devices/devices";
import { getCloudGameHash } from "@/operations/devices/devices";
import { restoreGame } from "@/operations/restore/restore/restore";
import { scanManualGame } from "@/operations/scanner/scanner/scanner";
import { addManualGame, getDeviceId } from "@/lib/store/store";
import { useSyncStore } from "@/stores/sync";

export const useRestoreBackup = (game: Game) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { setGameStatus, updateSyncFingerprint } = useSyncStore();

  return useMutation({
    mutationFn: async (params?: {
      backupId?: string;
      targetPaths?: string[];
    }) => {
      const resolvedId =
        params?.backupId ?? (await listGameBackups(game.name))[0]?.id;

      if (!resolvedId) throw new Error(t("restore.noBackups"));

      setGameStatus(game.name, SYNC_STATUS.restoring);
      const result = await restoreGame(game, resolvedId, params?.targetPaths);

      if (result.status !== RECORD_STATUS.success) {
        throw new Error(result.error ?? t("restore.error"));
      }

      return result;
    },
    onSuccess: async (_data, params) => {
      try {
        setGameStatus(game.name, SYNC_STATUS.success);
        const cloudHash = await getCloudGameHash(game.name);
        if (cloudHash) {
          await updateSyncFingerprint(game.name, cloudHash.hash);
        }
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.syncHistory });

        if (!game.isCloudOnly || !params?.targetPaths?.length) {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.games });
          return;
        }

        await addManualGame(game.name, params.targetPaths);
        const deviceId = await getDeviceId();
        await saveDeviceSync(deviceId, game.name, params.targetPaths);
        const scanned = await scanManualGame(game.name, params.targetPaths);
        await queryClient.cancelQueries({ queryKey: QUERY_KEYS.games });
        queryClient.setQueryData<Game[]>(QUERY_KEYS.games, (prev = []) =>
          [
            ...prev.filter((existing) => existing.name !== game.name),
            scanned,
          ].sort((gameA, gameB) => gameA.name.localeCompare(gameB.name)),
        );
      } catch (error) {
        console.error("Post-restore update failed:", error);
        setGameStatus(game.name, SYNC_STATUS.error);
      }
    },
    onError: () => {
      setGameStatus(game.name, SYNC_STATUS.error);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.syncHistory });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.games });
    },
  });
};
