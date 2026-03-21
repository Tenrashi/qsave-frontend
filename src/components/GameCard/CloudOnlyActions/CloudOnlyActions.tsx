import { useTranslation } from "react-i18next";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SYNC_STATUS } from "@/domain/types";
import type { Game, SyncStatus } from "@/domain/types";
import { RestoreDialog } from "../RestoreDialog/RestoreDialog";

export type CloudOnlyActionsProps = {
  game: Game;
  status: SyncStatus;
  isBusy: boolean;
};

export const CloudOnlyActions = ({
  game,
  status,
  isBusy,
}: CloudOnlyActionsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <span className="text-muted-foreground">{t("games.cloudOnlyHint")}</span>
      <RestoreDialog
        game={game}
        trigger={
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2"
            disabled={isBusy}
            aria-label={t("restore.tooltipPick")}
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
    </>
  );
};
