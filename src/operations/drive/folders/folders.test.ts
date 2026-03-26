import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ensureQSaveFolder,
  ensureGameFolder,
  ensureDevicesFolder,
} from "./folders";

const {
  mockGetDriveFolderId,
  mockSetDriveFolderId,
  mockGetFolder,
  mockPostFolder,
} = vi.hoisted(() => ({
  mockGetDriveFolderId: vi.fn(),
  mockSetDriveFolderId: vi.fn(),
  mockGetFolder: vi.fn(),
  mockPostFolder: vi.fn(),
}));

vi.mock("@/lib/store/store", () => ({
  getDriveFolderId: mockGetDriveFolderId,
  setDriveFolderId: mockSetDriveFolderId,
}));

vi.mock("@/services/drive/drive", () => ({
  getFolder: mockGetFolder,
  postFolder: mockPostFolder,
}));

describe("folders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ensureQSaveFolder", () => {
    it("returns cached folder ID when it matches Drive", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce("cached-id");
      mockGetFolder.mockResolvedValueOnce("cached-id");

      const result = await ensureQSaveFolder();

      expect(result).toBe("cached-id");
      expect(mockGetFolder).toHaveBeenCalledWith("QSave", "root");
      expect(mockSetDriveFolderId).not.toHaveBeenCalled();
    });

    it("finds existing folder when cache misses", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce(undefined);
      mockGetFolder.mockResolvedValueOnce("existing-id");

      const result = await ensureQSaveFolder();

      expect(result).toBe("existing-id");
      expect(mockSetDriveFolderId).toHaveBeenCalledWith(
        "__root__",
        "existing-id",
      );
    });

    it("creates folder when not found", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce(undefined);
      mockGetFolder.mockResolvedValueOnce(null);
      mockPostFolder.mockResolvedValueOnce("new-id");

      const result = await ensureQSaveFolder();

      expect(result).toBe("new-id");
      expect(mockPostFolder).toHaveBeenCalledWith("QSave", "root");
    });

    it("updates cache when Drive ID differs from cached", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce("stale-cached-id");
      mockGetFolder.mockResolvedValueOnce("different-id");

      const result = await ensureQSaveFolder();

      expect(result).toBe("different-id");
      expect(mockGetFolder).toHaveBeenCalledTimes(1);
      expect(mockSetDriveFolderId).toHaveBeenCalledWith(
        "__root__",
        "different-id",
      );
    });

    it("wraps errors with context", async () => {
      mockGetDriveFolderId.mockRejectedValueOnce(new Error("store fail"));

      await expect(ensureQSaveFolder()).rejects.toThrow(
        "Failed to ensure QSave folder",
      );
    });

    it("handles non-Error throw in wrapping", async () => {
      mockGetDriveFolderId.mockRejectedValueOnce("string error");

      await expect(ensureQSaveFolder()).rejects.toThrow(
        "Failed to ensure QSave folder",
      );
    });
  });

  describe("ensureGameFolder", () => {
    beforeEach(() => {
      mockGetDriveFolderId.mockResolvedValueOnce("root-id");
      mockGetFolder.mockResolvedValueOnce("root-id");
    });

    it("returns cached game folder ID when valid", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce("game-folder");
      mockGetFolder.mockResolvedValueOnce("game-folder");

      const result = await ensureGameFolder("Sims 4");

      expect(result).toBe("game-folder");
    });

    it("finds existing game folder", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce(undefined);
      mockGetFolder.mockResolvedValueOnce("found-id");

      const result = await ensureGameFolder("Sims 4");

      expect(result).toBe("found-id");
      expect(mockSetDriveFolderId).toHaveBeenCalledWith("Sims 4", "found-id");
    });

    it("creates game folder when not found", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce(undefined);
      mockGetFolder.mockResolvedValueOnce(null);
      mockPostFolder.mockResolvedValueOnce("created-id");

      const result = await ensureGameFolder("Sims 4");

      expect(result).toBe("created-id");
      expect(mockPostFolder).toHaveBeenCalledWith("Sims 4", "root-id");
    });

    it("wraps errors with gameName context", async () => {
      mockGetDriveFolderId.mockRejectedValueOnce(new Error("store fail"));

      await expect(ensureGameFolder("Sims 4")).rejects.toThrow(
        'Failed to ensure game folder "Sims 4"',
      );
    });

    it("handles non-Error throw in game folder wrapping", async () => {
      mockGetDriveFolderId.mockRejectedValueOnce("string error");

      await expect(ensureGameFolder("Sims 4")).rejects.toThrow(
        'Failed to ensure game folder "Sims 4"',
      );
    });
  });

  describe("ensureDevicesFolder", () => {
    beforeEach(() => {
      mockGetDriveFolderId.mockResolvedValueOnce("root-id");
      mockGetFolder.mockResolvedValueOnce("root-id");
    });

    it("returns cached devices folder ID when it matches Drive", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce("devices-folder");
      mockGetFolder.mockResolvedValueOnce("devices-folder");

      const result = await ensureDevicesFolder();

      expect(result).toBe("devices-folder");
    });

    it("finds existing devices folder", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce(undefined);
      mockGetFolder.mockResolvedValueOnce("found-devices");

      const result = await ensureDevicesFolder();

      expect(result).toBe("found-devices");
      expect(mockSetDriveFolderId).toHaveBeenCalledWith(
        "devices",
        "found-devices",
      );
    });

    it("creates devices folder when not found", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce(undefined);
      mockGetFolder.mockResolvedValueOnce(null);
      mockPostFolder.mockResolvedValueOnce("new-devices");

      const result = await ensureDevicesFolder();

      expect(result).toBe("new-devices");
      expect(mockPostFolder).toHaveBeenCalledWith("devices", "root-id");
    });

    it("wraps errors with context", async () => {
      mockGetDriveFolderId.mockRejectedValueOnce(new Error("fail"));

      await expect(ensureDevicesFolder()).rejects.toThrow(
        "Failed to ensure devices folder",
      );
    });
  });
});
