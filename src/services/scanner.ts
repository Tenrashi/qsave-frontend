import { invoke } from "@tauri-apps/api/core";
import type { Game, SaveFile } from "@/domain/types";
import { TAURI_COMMANDS } from "@/lib/constants";
import { getManualGames } from "@/lib/store";

type RustSaveFile = {
  name: string;
  path: string;
  sizeBytes: number;
  lastModified: number;
  gameName: string;
};

type RustDetectedGame = {
  name: string;
  steamId: number | null;
  savePaths: string[];
  saveFiles: RustSaveFile[];
};

const toGame = (game: RustDetectedGame, isManual = false): Game => ({
  name: game.name,
  steamId: game.steamId ?? undefined,
  savePaths: game.savePaths,
  saveFiles: game.saveFiles.map(
    (f): SaveFile => ({
      name: f.name,
      path: f.path,
      sizeBytes: f.sizeBytes,
      lastModified: new Date(f.lastModified),
      gameName: f.gameName,
    }),
  ),
  isManual,
});

export const scanManualGame = async (name: string, paths: string[]): Promise<Game> => {
  const result = await invoke<RustDetectedGame>(TAURI_COMMANDS.scanManualGame, { name, paths });
  return toGame(result, true);
};

export const rescanGame = async (game: Game): Promise<Game> => {
  const result = await invoke<RustDetectedGame>(TAURI_COMMANDS.scanManualGame, {
    name: game.name,
    paths: game.savePaths,
  });
  return toGame(result, game.isManual);
};

export const scanForGames = async (): Promise<Game[]> => {
  const [autoResults, manualEntries] = await Promise.all([
    invoke<RustDetectedGame[]>(TAURI_COMMANDS.scanGames),
    getManualGames(),
  ]);

  const autoGames = autoResults.map((game) => toGame(game));
  const autoNames = new Set(autoGames.map((game) => game.name));

  const manualGames = await Promise.all(
    manualEntries
      .filter((entry) => !autoNames.has(entry.name))
      .map((entry) =>
        invoke<RustDetectedGame>(TAURI_COMMANDS.scanManualGame, {
          name: entry.name,
          paths: entry.paths,
        }).then((game) => toGame(game, true)),
      ),
  );

  return [...autoGames, ...manualGames].sort((gameA, gameB) => gameA.name.localeCompare(gameB.name));
};
