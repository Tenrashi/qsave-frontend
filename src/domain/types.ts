export type Game = {
  name: string;
  savePaths: string[];
  saveFiles: SaveFile[];
};

export type SaveFile = {
  name: string;
  path: string;
  sizeBytes: number;
  lastModified: Date;
  gameName: string;
};

export type SyncRecord = {
  id: string;
  gameName: string;
  fileName: string;
  syncedAt: Date;
  driveFileId: string;
  revisionCount: number;
  status: "success" | "error";
  error?: string;
};

export type AuthState = {
  isAuthenticated: boolean;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

export type SyncStatus = "idle" | "syncing" | "success" | "error";

export type GameSyncState = {
  gameName: string;
  status: SyncStatus;
};
