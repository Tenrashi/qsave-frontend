import { invoke } from "@tauri-apps/api/core";
import type { Game, SaveFile } from "@/domain/types";
import { TAURI_COMMANDS } from "@/lib/constants/constants";
import { getManualGames } from "@/lib/store/store";
import type { RustDetectedGame } from "./scanner.types";

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
  registryKeys: game.registryKeys.length > 0 ? game.registryKeys : undefined,
  isManual,
  platform: game.platform ?? undefined,
  hasSteamCloud: game.hasSteamCloud,
});

export const scanManualGame = async (
  name: string,
  paths: string[],
): Promise<Game> => {
  const result = await invoke<RustDetectedGame>(TAURI_COMMANDS.scanManualGame, {
    name,
    paths,
  });
  return toGame(result, true);
};

export const rescanGame = async (game: Game): Promise<Game> => {
  const result = await invoke<RustDetectedGame>(TAURI_COMMANDS.scanManualGame, {
    name: game.name,
    paths: game.savePaths,
  });
  return toGame(result, game.isManual);
};

export const loadCachedGames = async (): Promise<Game[]> => {
  const [cachedResults, manualEntries] = await Promise.all([
    invoke<RustDetectedGame[]>(TAURI_COMMANDS.getCachedGames),
    getManualGames(),
  ]);

  if (cachedResults.length === 0) return [];

  const autoGames = cachedResults.map((game) => toGame(game));
  const autoNames = new Set(autoGames.map((game) => game.name));

  const manualGames: Game[] = manualEntries
    .filter((entry) => !autoNames.has(entry.name))
    .map((entry) => ({
      name: entry.name,
      savePaths: entry.paths,
      saveFiles: [],
      isManual: true,
    }));

  return [...autoGames, ...manualGames].sort((gameA, gameB) =>
    gameA.name.localeCompare(gameB.name),
  );
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

  return [...autoGames, ...manualGames].sort((gameA, gameB) =>
    gameA.name.localeCompare(gameB.name),
  );
};
