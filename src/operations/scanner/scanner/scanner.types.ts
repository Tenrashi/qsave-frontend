import type { Platform } from "@/domain/types";

export type RustSaveFile = {
  name: string;
  path: string;
  sizeBytes: number;
  lastModified: number;
  gameName: string;
};

export type RustDetectedGame = {
  name: string;
  steamId: number | null;
  savePaths: string[];
  saveFiles: RustSaveFile[];
  registryKeys: string[];
  platform: Platform | null;
  hasSteamCloud: boolean;
};
