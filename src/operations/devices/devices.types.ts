export type GameDeviceInfo = {
  paths: string[];
  lastHash?: string;
  lastSyncedAt?: string;
};

export type DeviceEntry = {
  os: string;
  games: Record<string, string[] | GameDeviceInfo>;
};

export type DevicesMap = Record<string, DeviceEntry>;

export const normalizeGameInfo = (
  value: string[] | GameDeviceInfo,
): GameDeviceInfo => (Array.isArray(value) ? { paths: value } : value);
