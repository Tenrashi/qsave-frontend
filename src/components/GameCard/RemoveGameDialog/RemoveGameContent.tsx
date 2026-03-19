import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type RemoveGameContentProps = {
  onConfirm: () => void;
};

export const RemoveGameContent = ({ onConfirm }: RemoveGameContentProps) => {
  const { t } = useTranslation();

  return (
    <>
      <DialogTitle className="mb-1">
        {t("games.removeConfirmTitle")}
      </DialogTitle>
      <DialogDescription className="mb-4">
        {t("games.removeConfirmDescription")}
      </DialogDescription>

      <div className="flex justify-end gap-2">
        <DialogClose render={<Button variant="ghost" />}>
          {t("games.cancel")}
        </DialogClose>
        <Button variant="destructive" onClick={onConfirm}>
          {t("games.remove")}
        </Button>
      </div>
    </>
  );
};
