import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteGameBackup } from "@/operations/drive/backups/backups";
import { GAME_BACKUPS_KEY } from "@/hooks/queries/useGameBackups/useGameBackups";

export const useDeleteBackup = (gameName: string, onSuccess?: () => void) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (backupId: string) => deleteGameBackup(backupId),
    onSuccess: () => {
      onSuccess?.();
      queryClient.invalidateQueries({ queryKey: GAME_BACKUPS_KEY(gameName) });
    },
  });
};
