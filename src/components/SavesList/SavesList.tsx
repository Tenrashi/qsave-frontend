import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Gamepad2 } from "lucide-react";
import type { Game } from "@/domain/types";
import { GameCard } from "@/components/GameCard/GameCard";

const ESTIMATED_HEIGHT = 60;

export type SavesListProps = {
  games: Game[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
};

export const SavesList = ({ games, scrollRef }: SavesListProps) => {
  const { t } = useTranslation();

  const virtualizer = useVirtualizer({
    count: games.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_HEIGHT,
    overscan: 10,
    gap: 8,
  });

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Gamepad2 className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-base font-medium">{t("games.noGamesDetected")}</p>
        <p className="text-sm mt-1">{t("games.noGamesHint")}</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => (
        <div
          key={games[virtualItem.index].name}
          ref={virtualizer.measureElement}
          data-index={virtualItem.index}
          className="absolute left-0 w-full"
          style={{ top: virtualItem.start }}
        >
          <GameCard game={games[virtualItem.index]} />
        </div>
      ))}
    </div>
  );
};
