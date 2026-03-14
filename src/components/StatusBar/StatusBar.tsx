import { useTranslation } from "react-i18next";
import { Eye, Gamepad2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Game } from "@/domain/types";

export type StatusBarProps = {
  games: Game[];
  watchedCount: number;
};

export const StatusBar = ({ games, watchedCount }: StatusBarProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-t text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Eye className="w-3 h-3" />
        <span>
          {watchedCount > 0 ? t("status.watchingActive") : t("status.watchingInactive")}
        </span>
      </div>
      <Separator orientation="vertical" className="h-3" />
      <div className="flex items-center gap-1.5">
        <Gamepad2 className="w-3 h-3" />
        <span>{t("status.game", { count: games.length })}</span>
      </div>
    </div>
  );
};
