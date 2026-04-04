import { useTranslation } from "react-i18next";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Game } from "@/domain/types";
import { RestoreBody } from "./RestoreBody/RestoreBody";

export type RestoreContentProps = {
  game: Game;
  quick?: boolean;
  open: boolean;
};

export const RestoreContent = ({ game, quick, open }: RestoreContentProps) => {
  const { t } = useTranslation();

  const title = quick
    ? t("restore.confirmTitle")
    : t("restore.title", { name: game.name });

  const description = quick ? undefined : t("restore.selectBackup");

  return (
    <>
      <DialogTitle className={description ? "mb-1" : "mb-4"}>
        {title}
      </DialogTitle>
      {description && (
        <DialogDescription className="mb-4">{description}</DialogDescription>
      )}
      <RestoreBody game={game} quick={quick} open={open} />
    </>
  );
};
