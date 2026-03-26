import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildDevicesMap,
  findDeviceGamePaths,
  saveDevicePaths,
} from "./devices";

const {
  mockEnsureDevicesFolder,
  mockGetDeviceFile,
  mockGetFile,
  mockGetFilesInFolder,
  mockPutDeviceFile,
} = vi.hoisted(() => ({
  mockEnsureDevicesFolder: vi.fn(() => Promise.resolve("devices-folder")),
  mockGetDeviceFile: vi.fn(),
  mockGetFile: vi.fn(),
  mockGetFilesInFolder: vi.fn(),
  mockPutDeviceFile: vi.fn(),
}));

vi.mock("@/services/drive/drive", () => ({
  getDeviceFile: mockGetDeviceFile,
  getFile: mockGetFile,
  getFilesInFolder: mockGetFilesInFolder,
  putDeviceFile: mockPutDeviceFile,
}));

vi.mock("@/operations/drive/folders/folders", () => ({
  ensureDevicesFolder: mockEnsureDevicesFolder,
}));

describe("devices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureDevicesFolder.mockResolvedValue("devices-folder");
  });

  describe("buildDevicesMap", () => {
    it("returns devices map from per-device files", async () => {
      const deviceEntry = { os: "windows", games: { "Sims 4": ["/saves"] } };
      mockGetFilesInFolder.mockResolvedValueOnce([
        { id: "file-1", name: "device-1.json", createdTime: "2026-01-01" },
      ]);
      mockGetDeviceFile.mockResolvedValueOnce(deviceEntry);

      const result = await buildDevicesMap();

      expect(result).toEqual({ "device-1": deviceEntry });
    });

    it("returns empty object when no device files exist", async () => {
      mockGetFilesInFolder.mockResolvedValueOnce([]);

      const result = await buildDevicesMap();

      expect(result).toEqual({});
    });

    it("skips device files that fail to download", async () => {
      mockGetFilesInFolder.mockResolvedValueOnce([
        { id: "file-1", name: "device-1.json", createdTime: "2026-01-01" },
      ]);
      mockGetDeviceFile.mockResolvedValueOnce(null);

      const result = await buildDevicesMap();

      expect(result).toEqual({});
    });

    it("returns empty object when getDevicesFolderId throws", async () => {
      mockEnsureDevicesFolder.mockRejectedValueOnce(new Error("fail"));

      const result = await buildDevicesMap();

      expect(result).toEqual({});
    });
  });

  describe("findDeviceGamePaths", () => {
    it("returns paths for existing device and game", async () => {
      const deviceEntry = {
        os: "windows",
        games: { "Sims 4": ["/saves/sims"] },
      };
      mockGetFile.mockResolvedValueOnce("device-file");
      mockGetDeviceFile.mockResolvedValueOnce(deviceEntry);

      const result = await findDeviceGamePaths("device-1", "Sims 4");

      expect(result).toEqual(["/saves/sims"]);
    });

    it("returns undefined when device file does not exist", async () => {
      mockGetFile.mockResolvedValueOnce(null);

      const result = await findDeviceGamePaths("unknown", "Sims 4");

      expect(result).toBeUndefined();
    });

    it("returns undefined when ensureDevicesFolder throws", async () => {
      mockEnsureDevicesFolder.mockRejectedValueOnce(new Error("fail"));

      const result = await findDeviceGamePaths("device-1", "Sims 4");

      expect(result).toBeUndefined();
    });

    it("returns undefined for unknown game in existing device", async () => {
      const deviceEntry = { os: "windows", games: {} };
      mockGetFile.mockResolvedValueOnce("device-file");
      mockGetDeviceFile.mockResolvedValueOnce(deviceEntry);

      const result = await findDeviceGamePaths("device-1", "Unknown Game");

      expect(result).toBeUndefined();
    });
  });

  describe("saveDevicePaths", () => {
    it("creates new device entry when file does not exist", async () => {
      mockGetFile.mockResolvedValueOnce(null);

      await saveDevicePaths("device-1", "Sims 4", ["/saves"]);

      expect(mockPutDeviceFile).toHaveBeenCalledWith(
        "devices-folder",
        "device-1",
        expect.objectContaining({ games: { "Sims 4": ["/saves"] } }),
        null,
      );
    });

    it("merges games into existing device entry", async () => {
      const existingEntry = {
        os: "windows",
        games: { "Other Game": ["/other"] },
      };
      mockGetFile.mockResolvedValueOnce("existing-file");
      mockGetDeviceFile.mockResolvedValueOnce(existingEntry);

      await saveDevicePaths("device-1", "Sims 4", ["/saves"]);

      expect(mockPutDeviceFile).toHaveBeenCalledWith(
        "devices-folder",
        "device-1",
        {
          os: "windows",
          games: { "Other Game": ["/other"], "Sims 4": ["/saves"] },
        },
        "existing-file",
      );
    });

    it("wraps errors with context", async () => {
      mockEnsureDevicesFolder.mockRejectedValueOnce(new Error("fail"));

      await expect(
        saveDevicePaths("device-1", "Sims 4", ["/saves"]),
      ).rejects.toThrow("Failed to update device paths");
    });

    it("handles non-Error throw in wrapping", async () => {
      mockEnsureDevicesFolder.mockRejectedValueOnce("string error");

      await expect(
        saveDevicePaths("device-1", "Sims 4", ["/saves"]),
      ).rejects.toThrow("Failed to update device paths");
    });
  });
});
