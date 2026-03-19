import { useQuery } from "@tanstack/react-query";
import { scanForGames } from "@/services/scanner/scanner";
import { QUERY_KEYS } from "@/lib/constants/constants";

export const useGames = () => {
  return useQuery({
    queryKey: QUERY_KEYS.games,
    queryFn: scanForGames,
    staleTime: 30_000,
  });
};
