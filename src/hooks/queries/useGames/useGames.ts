import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  scanForGames,
  loadCachedGames,
} from "@/operations/scanner/scanner/scanner";
import { QUERY_KEYS } from "@/lib/constants/constants";

const CACHED_GAMES_KEY = [...QUERY_KEYS.games, "cached"] as const;

export const useGames = () => {
  const { t } = useTranslation();

  const cachedQuery = useQuery({
    queryKey: CACHED_GAMES_KEY,
    queryFn: loadCachedGames,
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: QUERY_KEYS.games,
    queryFn: scanForGames,
    placeholderData: cachedQuery.data,
    staleTime: 30_000,
    meta: { errorMessage: t("toast.scanFailed") },
  });
};
