import { useQuery } from "@tanstack/react-query";
import { scanForGames } from "@/services/scanner";

export const useGames = () => {
  return useQuery({
    queryKey: ["games"],
    queryFn: scanForGames,
    staleTime: 30_000,
  });
};
