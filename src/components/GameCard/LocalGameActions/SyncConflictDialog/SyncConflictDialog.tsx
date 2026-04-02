import { useTranslation } from "react-i18next";
import { AlertTriangle, Upload, Download } from "lucide-react";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type SyncConflictDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadAnyway: () => void;
  onDownloadCloud: () => void;
};

export const SyncConflictDialog = ({
  open,
  onOpenChange,
  onUploadAnyway,
  onDownloadCloud,
}: SyncConflictDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md">
        <div className="flex flex-col items-center gap-2 text-center">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
          <DialogTitle>{t("sync.conflictTitle")}</DialogTitle>
          <DialogDescription>{t("sync.conflictDescription")}</DialogDescription>
        </div>
        <div className="mt-4 text-center">
          <div className="inline-grid gap-2">
            <Button
              onClick={() => {
                onOpenChange(false);
                onUploadAnyway();
              }}
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {t("sync.uploadAnyway")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                onOpenChange(false);
                onDownloadCloud();
              }}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {t("sync.downloadCloud")}
            </Button>
            <DialogClose render={<Button variant="ghost" />}>
              {t("games.cancel")}
            </DialogClose>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
};
