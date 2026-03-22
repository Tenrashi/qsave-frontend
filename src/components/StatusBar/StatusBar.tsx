import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Gamepad2, Power, PowerOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Game } from "@/domain/types";

export type StatusBarProps = {
  games: Game[];
  watching: boolean;
  onToggleWatching: () => void;
  autostart: boolean;
  onToggleAutostart: () => void;
};

export const StatusBar = ({
  games,
  watching,
  onToggleWatching,
  autostart,
  onToggleAutostart,
}: StatusBarProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-t text-xs text-muted-foreground">
      <button
        onClick={onToggleWatching}
        className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
      >
        {watching ? (
          <Eye className="w-3 h-3" />
        ) : (
          <EyeOff className="w-3 h-3" />
        )}
        <span>
          {watching ? t("status.watchingActive") : t("status.watchingInactive")}
        </span>
      </button>
      <Separator orientation="vertical" className="h-3" />
      <button
        onClick={onToggleAutostart}
        className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
      >
        {autostart ? (
          <Power className="w-3 h-3" />
        ) : (
          <PowerOff className="w-3 h-3" />
        )}
        <span>
          {autostart
            ? t("status.autostartActive")
            : t("status.autostartInactive")}
        </span>
      </button>
      <Separator orientation="vertical" className="h-3" />
      <div className="flex items-center gap-1.5">
        <Gamepad2 className="w-3 h-3" />
        <span>{t("status.game", { count: games.length })}</span>
      </div>
    </div>
  );
};
