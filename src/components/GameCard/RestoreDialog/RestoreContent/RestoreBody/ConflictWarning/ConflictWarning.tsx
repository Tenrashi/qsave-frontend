import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Game } from "@/domain/types";
import { useSyncAndUpdate } from "@/hooks/useSyncAndUpdate/useSyncAndUpdate";

export type ConflictWarningProps = {
  game: Game;
  onRestoreAnyway: () => void;
  onClose: () => void;
};

export const ConflictWarning = ({
  game,
  onRestoreAnyway,
  onClose,
}: ConflictWarningProps) => {
  const { t } = useTranslation();
  const syncAndUpdate = useSyncAndUpdate();
  const [uploading, setUploading] = useState(false);

  const handleUploadFirst = async () => {
    setUploading(true);
    try {
      await syncAndUpdate(game);
      onClose();
    } catch {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <p>{t("restore.conflictWarning")}</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleUploadFirst}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <Upload className="w-3.5 h-3.5 mr-1.5" />
          )}
          {t("restore.uploadFirst")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRestoreAnyway}
          disabled={uploading}
        >
          {t("restore.restoreAnyway")}
        </Button>
      </div>
    </div>
  );
};
