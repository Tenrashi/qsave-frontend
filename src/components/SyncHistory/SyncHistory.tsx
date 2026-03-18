import { useTranslation } from "react-i18next";
import { CheckCircle, AlertCircle, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RECORD_STATUS } from "@/domain/types";
import { useSyncHistory } from "@/hooks/useSyncHistory";
import { dateFnsLocales } from "@/lib/date-locales";
import { MAX_RECENT_ENTRIES } from "./SyncHistory.const";

export const SyncHistory = () => {
  const { t, i18n } = useTranslation();
  const { data: history = [] } = useSyncHistory();
  const recent = history.slice(0, MAX_RECENT_ENTRIES);
  const locale = dateFnsLocales[i18n.language] ?? enUS;

  if (recent.length === 0) return null;

  return (
    <Card size="sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          {t("history.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[72px]">
          <div className="space-y-0.5">
            {recent.map((record) => (
              <div key={record.id} className="flex items-center gap-2 py-1 text-xs">
                {record.status === RECORD_STATUS.success ? (
                  <CheckCircle className="w-3 h-3 text-green-500 shrink-0" role="img" aria-label={t("history.successIcon")} aria-hidden={false} />
                ) : (
                  <AlertCircle className="w-3 h-3 text-destructive shrink-0" role="img" aria-label={t("history.errorIcon")} aria-hidden={false} />
                )}
                <span className="truncate">{record.gameName}</span>
                <span className="text-muted-foreground text-xs ml-auto shrink-0">
                  {formatDistanceToNow(new Date(record.syncedAt), { addSuffix: true, locale })}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
