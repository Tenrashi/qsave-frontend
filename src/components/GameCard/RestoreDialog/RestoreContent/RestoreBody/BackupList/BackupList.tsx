import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import type { DriveBackup } from "@/domain/types";
import { DeleteBackupDialog } from "@/components/GameCard/DeleteBackupDialog/DeleteBackupDialog";
import { dateFnsLocales } from "@/lib/date-locales/date-locales";

export type BackupListProps = {
  backups: DriveBackup[];
  selected?: DriveBackup;
  onSelect: (backup: DriveBackup) => void;
  onDelete: (backupId: string) => void;
};

export const BackupList = ({
  backups,
  selected,
  onSelect,
  onDelete,
}: BackupListProps) => {
  const { t, i18n } = useTranslation();
  const locale = dateFnsLocales[i18n.language] ?? enUS;

  return (
    <>
      <ul className="space-y-1">
        {backups.map((backup) => {
          const isSelected = selected?.id === backup.id;
          return (
            <li key={backup.id} className="flex items-center gap-1">
              <button
                type="button"
                className={`flex-1 text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-muted border border-transparent"
                }`}
                onClick={() => onSelect(backup)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {formatDistanceToNow(new Date(backup.createdTime), {
                      addSuffix: true,
                      locale,
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(backup.createdTime).toLocaleDateString(
                      i18n.language,
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </span>
                </div>
              </button>
              <DeleteBackupDialog
                trigger={
                  <button
                    type="button"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    aria-label={t("restore.delete")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                }
                onConfirm={() => onDelete(backup.id)}
              />
            </li>
          );
        })}
      </ul>

      {selected && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
          {t("restore.warning")}
        </p>
      )}
    </>
  );
};
