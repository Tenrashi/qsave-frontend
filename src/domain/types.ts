export type Game = {
  name: string;
  steamId?: number;
  savePaths: string[];
  saveFiles: SaveFile[];
  isManual?: boolean;
};

export type SaveFile = {
  name: string;
  path: string;
  sizeBytes: number;
  lastModified: Date;
  gameName: string;
};

export const SYNC_STATUS = {
  idle: "idle",
  syncing: "syncing",
  success: "success",
  error: "error",
} as const;

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

export const RECORD_STATUS = {
  success: "success",
  error: "error",
} as const;

export type RecordStatus = (typeof RECORD_STATUS)[keyof typeof RECORD_STATUS];

export type SyncRecord = {
  id: string;
  gameName: string;
  fileName: string;
  syncedAt: Date;
  driveFileId: string;
  revisionCount: number;
  status: RecordStatus;
  error?: string;
};

export type AuthState = {
  isAuthenticated: boolean;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

export type GameSyncState = {
  gameName: string;
  status: SyncStatus;
};

export type GameSyncFingerprint = {
  hash: string;
  syncedAt: string;
};
