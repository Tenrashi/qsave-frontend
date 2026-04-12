import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { classifyError } from "@/lib/errors/classifyError";
import { deleteGameBackup } from "@/operations/drive/backups/backups";
import { GAME_BACKUPS_KEY } from "@/hooks/queries/useGameBackups/useGameBackups";

export const useDeleteBackup = (gameName: string, onSuccess?: () => void) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (backupId: string) => deleteGameBackup(backupId),
    onSuccess: () => {
      onSuccess?.();
      queryClient.invalidateQueries({ queryKey: GAME_BACKUPS_KEY(gameName) });
      toast.success(t("toast.deleteSuccess"));
    },
    onError: (error) => {
      toast.error(t("toast.deleteFailed"), {
        description: t(
          classifyError(error instanceof Error ? error.message : String(error)),
        ),
        duration: 10_000,
      });
    },
  });
};
