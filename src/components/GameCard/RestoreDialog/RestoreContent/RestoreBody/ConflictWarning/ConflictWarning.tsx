import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

export const ConflictWarning = () => {
  const { t } = useTranslation();

  return (
    <div className="flex gap-2 text-sm text-amber-600 dark:text-amber-400">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <p>{t("restore.conflictWarning")}</p>
    </div>
  );
};
