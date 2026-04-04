import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  scanForGames,
  loadCachedGames,
} from "@/operations/scanner/scanner/scanner";
import { QUERY_KEYS } from "@/lib/constants/constants";

export const useGames = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadCachedGames().then((cached) => {
      if (cached.length > 0 && !queryClient.getQueryData(QUERY_KEYS.games)) {
        queryClient.setQueryData(QUERY_KEYS.games, cached);
      }
    });
  }, [queryClient]);

  return useQuery({
    queryKey: QUERY_KEYS.games,
    queryFn: scanForGames,
    staleTime: 30_000,
    meta: { errorMessage: t("toast.scanFailed") },
  });
};
