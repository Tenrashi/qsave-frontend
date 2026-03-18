import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Game } from "@/domain/types";
import { notify } from "@/lib/notify";
import { APP_NAME } from "@/lib/constants";

export const useGameDetectionNotify = (games: Game[] | undefined): void => {
  const { t } = useTranslation();
  const knownGamesRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!games?.length) return;

    const currentNames = new Set(games.map((game) => game.name));

    // First load — seed known games without notifying
    if (!knownGamesRef.current) {
      knownGamesRef.current = currentNames;
      return;
    }

    const newGames = games.filter((game) => !knownGamesRef.current!.has(game.name));
    knownGamesRef.current = currentNames;

    if (newGames.length === 0) return;

    if (newGames.length === 1) {
      notify(APP_NAME, t("notifications.gameDetectedOne", { name: newGames[0].name }));
    } else {
      notify(APP_NAME, t("notifications.gameDetectedOther", { count: newGames.length }));
    }
  }, [games, t]);
};
