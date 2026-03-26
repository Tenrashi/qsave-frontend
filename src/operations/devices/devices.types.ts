export type DeviceEntry = {
  os: string;
  games: Record<string, string[]>;
};

export type DevicesMap = Record<string, DeviceEntry>;
