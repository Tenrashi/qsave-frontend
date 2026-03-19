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
};
