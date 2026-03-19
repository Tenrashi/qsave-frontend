import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type RemoveGameDialogProps = {
  trigger: React.ReactElement;
  onConfirm: () => void;
};

export const RemoveGameDialog = ({ trigger, onConfirm }: RemoveGameDialogProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />

      <DialogPopup className="max-w-sm">
        <DialogTitle className="mb-1">{t("games.removeConfirmTitle")}</DialogTitle>
        <DialogDescription className="mb-4">
          {t("games.removeConfirmDescription")}
        </DialogDescription>

        <div className="flex justify-end gap-2">
          <DialogClose render={<Button variant="ghost" />}>
            {t("games.cancel")}
          </DialogClose>
          <Button variant="destructive" onClick={handleConfirm}>
            {t("games.remove")}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
};
