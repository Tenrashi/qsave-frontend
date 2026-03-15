import { useQuery } from "@tanstack/react-query";
import { scanForGames } from "@/services/scanner";
import type { Game } from "@/domain/types";

// TODO: remove mock data
const MOCK_GAMES: Game[] = Array.from({ length: 500 }, (_, i) => `Game ${String(i + 1).padStart(3, "0")}`).map((name, i) => ({
  name,
  savePaths: [`/mock/saves/${name.toLowerCase().replace(/\s+/g, "-")}`],
  saveFiles: Array.from({ length: 1 + (i % 4) }, (_, j) => ({
    name: `save_${j + 1}.dat`,
    path: `/mock/saves/${name.toLowerCase().replace(/\s+/g, "-")}/save_${j + 1}.dat`,
    sizeBytes: (i + 1) * 1_048_576 + j * 524_288,
    lastModified: new Date(Date.now() - (i * 2 + j) * 3_600_000),
    gameName: name,
  })),
}));

export const useGames = () => {
  return useQuery({
    queryKey: ["games"],
    // TODO: restore scanForGames
    queryFn: async () => MOCK_GAMES,
    staleTime: 30_000,
  });
};
