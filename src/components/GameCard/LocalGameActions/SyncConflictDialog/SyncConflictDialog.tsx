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
      <DialogPopup className="max-w-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-500" />
          <div className="space-y-1">
            <DialogTitle>{t("sync.conflictTitle")}</DialogTitle>
            <DialogDescription>
              {t("sync.conflictDescription")}
            </DialogDescription>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <DialogClose render={<Button variant="ghost" />}>
            {t("games.cancel")}
          </DialogClose>
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
          <Button
            onClick={() => {
              onOpenChange(false);
              onUploadAnyway();
            }}
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            {t("sync.uploadAnyway")}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
};
