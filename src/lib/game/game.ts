import type { Game } from "@/domain/types";

export const isRegistryOnly = (game: Game): boolean =>
  (game.registryKeys?.length ?? 0) > 0 && game.saveFiles.length === 0;
