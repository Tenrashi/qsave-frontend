import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildDevicesMap,
  findDeviceGamePaths,
  getCloudGameHash,
  saveDeviceSync,
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
    vi.resetAllMocks();
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

  describe("saveDeviceSync", () => {
    it("creates new device entry when file does not exist", async () => {
      mockGetFile.mockResolvedValueOnce(null);

      await saveDeviceSync("device-1", "Sims 4", ["/saves"]);

      expect(mockPutDeviceFile).toHaveBeenCalledWith(
        "devices-folder",
        "device-1",
        expect.objectContaining({
          games: { "Sims 4": { paths: ["/saves"] } },
        }),
        null,
      );
    });

    it("stores hash and timestamp when contentHash is provided", async () => {
      mockGetFile.mockResolvedValueOnce(null);

      await saveDeviceSync("device-1", "Sims 4", ["/saves"], "abc123");

      expect(mockPutDeviceFile).toHaveBeenCalledWith(
        "devices-folder",
        "device-1",
        expect.objectContaining({
          games: {
            "Sims 4": {
              paths: ["/saves"],
              lastHash: "abc123",
              lastSyncedAt: expect.any(String),
            },
          },
        }),
        null,
      );
    });

    it("detects Windows OS from userAgent", async () => {
      const original = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        configurable: true,
      });
      mockGetFile.mockResolvedValueOnce(null);

      await saveDeviceSync("device-1", "Sims 4", ["/saves"]);

      expect(mockPutDeviceFile).toHaveBeenCalledWith(
        "devices-folder",
        "device-1",
        expect.objectContaining({ os: "windows" }),
        null,
      );
      Object.defineProperty(navigator, "userAgent", {
        value: original,
        configurable: true,
      });
    });

    it("detects macOS from userAgent", async () => {
      const original = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        configurable: true,
      });
      mockGetFile.mockResolvedValueOnce(null);

      await saveDeviceSync("device-1", "Sims 4", ["/saves"]);

      expect(mockPutDeviceFile).toHaveBeenCalledWith(
        "devices-folder",
        "device-1",
        expect.objectContaining({ os: "macos" }),
        null,
      );
      Object.defineProperty(navigator, "userAgent", {
        value: original,
        configurable: true,
      });
    });

    it("merges games into existing device entry", async () => {
      const existingEntry = {
        os: "windows",
        games: { "Other Game": ["/other"] },
      };
      mockGetFile.mockResolvedValueOnce("existing-file");
      mockGetDeviceFile.mockResolvedValueOnce(existingEntry);

      await saveDeviceSync("device-1", "Sims 4", ["/saves"]);

      expect(mockPutDeviceFile).toHaveBeenCalledWith(
        "devices-folder",
        "device-1",
        {
          os: "windows",
          games: {
            "Other Game": ["/other"],
            "Sims 4": { paths: ["/saves"] },
          },
        },
        "existing-file",
      );
    });

    it("uses default entry when existing file content is null", async () => {
      mockGetFile.mockResolvedValueOnce("existing-file");
      mockGetDeviceFile.mockResolvedValueOnce(null);

      await saveDeviceSync("device-1", "Sims 4", ["/saves"]);

      expect(mockPutDeviceFile).toHaveBeenCalledWith(
        "devices-folder",
        "device-1",
        expect.objectContaining({
          games: { "Sims 4": { paths: ["/saves"] } },
        }),
        "existing-file",
      );
    });

    it("wraps errors with context", async () => {
      mockEnsureDevicesFolder.mockRejectedValueOnce(new Error("fail"));

      await expect(
        saveDeviceSync("device-1", "Sims 4", ["/saves"]),
      ).rejects.toThrow("Failed to update device paths");
    });

    it("handles non-Error throw in wrapping", async () => {
      mockEnsureDevicesFolder.mockRejectedValueOnce("string error");

      await expect(
        saveDeviceSync("device-1", "Sims 4", ["/saves"]),
      ).rejects.toThrow("Failed to update device paths");
    });
  });

  describe("getCloudGameHash", () => {
    it("returns latest hash across multiple devices", async () => {
      mockGetFilesInFolder.mockResolvedValueOnce([
        { id: "f1", name: "device-1.json", createdTime: "2026-01-01" },
        { id: "f2", name: "device-2.json", createdTime: "2026-01-01" },
      ]);
      mockGetDeviceFile
        .mockResolvedValueOnce({
          os: "windows",
          games: {
            "Sims 4": {
              paths: ["/saves"],
              lastHash: "older-hash",
              lastSyncedAt: "2026-03-10T12:00:00Z",
            },
          },
        })
        .mockResolvedValueOnce({
          os: "macos",
          games: {
            "Sims 4": {
              paths: ["/saves"],
              lastHash: "newer-hash",
              lastSyncedAt: "2026-03-14T12:00:00Z",
            },
          },
        });

      const result = await getCloudGameHash("Sims 4");

      expect(result).toEqual({
        hash: "newer-hash",
        syncedAt: "2026-03-14T12:00:00Z",
      });
    });

    it("returns null when game has no hash info", async () => {
      mockGetFilesInFolder.mockResolvedValueOnce([
        { id: "f1", name: "device-1.json", createdTime: "2026-01-01" },
      ]);
      mockGetDeviceFile.mockResolvedValueOnce({
        os: "windows",
        games: { "Sims 4": { paths: ["/saves"] } },
      });

      const result = await getCloudGameHash("Sims 4");

      expect(result).toBeNull();
    });

    it("returns null when game does not exist in any device", async () => {
      mockGetFilesInFolder.mockResolvedValueOnce([
        { id: "f1", name: "device-1.json", createdTime: "2026-01-01" },
      ]);
      mockGetDeviceFile.mockResolvedValueOnce({
        os: "windows",
        games: {},
      });

      const result = await getCloudGameHash("Unknown Game");

      expect(result).toBeNull();
    });

    it("returns null when buildDevicesMap throws", async () => {
      mockEnsureDevicesFolder.mockRejectedValueOnce(new Error("fail"));

      const result = await getCloudGameHash("Sims 4");

      expect(result).toBeNull();
    });

    it("handles legacy string[] game entries gracefully", async () => {
      mockGetFilesInFolder.mockResolvedValueOnce([
        { id: "f1", name: "device-1.json", createdTime: "2026-01-01" },
      ]);
      mockGetDeviceFile.mockResolvedValueOnce({
        os: "windows",
        games: { "Sims 4": ["/saves"] },
      });

      const result = await getCloudGameHash("Sims 4");

      expect(result).toBeNull();
    });

    it("skips devices without lastSyncedAt", async () => {
      mockGetFilesInFolder.mockResolvedValueOnce([
        { id: "f1", name: "device-1.json", createdTime: "2026-01-01" },
        { id: "f2", name: "device-2.json", createdTime: "2026-01-01" },
      ]);
      mockGetDeviceFile
        .mockResolvedValueOnce({
          os: "windows",
          games: {
            "Sims 4": { paths: ["/saves"], lastHash: "hash-no-time" },
          },
        })
        .mockResolvedValueOnce({
          os: "macos",
          games: {
            "Sims 4": {
              paths: ["/saves"],
              lastHash: "valid-hash",
              lastSyncedAt: "2026-03-14T12:00:00Z",
            },
          },
        });

      const result = await getCloudGameHash("Sims 4");

      expect(result).toEqual({
        hash: "valid-hash",
        syncedAt: "2026-03-14T12:00:00Z",
      });
    });
  });
});
