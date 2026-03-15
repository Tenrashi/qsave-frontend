import { invoke } from "@tauri-apps/api/core";
import type { Game, SaveFile } from "@/domain/types";

type RustSaveFile = {
  name: string;
  path: string;
  sizeBytes: number;
  lastModified: number;
  gameName: string;
};

type RustDetectedGame = {
  name: string;
  savePaths: string[];
  saveFiles: RustSaveFile[];
};

export async function scanForGames(): Promise<Game[]> {
  const results = await invoke<RustDetectedGame[]>("scan_games");

  return results.map((game) => ({
    name: game.name,
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
  }));
}
