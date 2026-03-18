import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SavesList } from "@/components/SavesList/SavesList";
import type { Game } from "@/domain/types";

export type GameListPanelProps = {
  games: Game[];
  isLoading: boolean;
};

export const GameListPanel = ({ games, isLoading }: GameListPanelProps) => {
  const { t } = useTranslation();
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const scrollRef = useCallback((node: HTMLDivElement | null) => setScrollElement(node), []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">{t("games.scanning")}</span>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 overflow-hidden" viewportRef={scrollRef}>
      <div className="px-4 pb-4">
        <SavesList games={games} scrollElement={scrollElement} />
      </div>
    </ScrollArea>
  );
};
