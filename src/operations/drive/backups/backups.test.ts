import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listBackedUpGameNames,
  listGameBackups,
  deleteGameBackup,
  uploadGameArchive,
} from "./backups";

const {
  mockInvoke,
  mockGetFilesInFolder,
  mockDeleteFile,
  mockPostFile,
  mockGetFolderNames,
  mockEnsureQSaveFolder,
  mockEnsureGameFolder,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockGetFilesInFolder: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockPostFile: vi.fn(),
  mockGetFolderNames: vi.fn(),
  mockEnsureQSaveFolder: vi.fn(),
  mockEnsureGameFolder: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@/services/drive/drive", () => ({
  getFilesInFolder: mockGetFilesInFolder,
  deleteFile: mockDeleteFile,
  postFile: mockPostFile,
  getFolderNames: mockGetFolderNames,
}));

vi.mock("@/operations/drive/folders/folders", () => ({
  ensureQSaveFolder: mockEnsureQSaveFolder,
  ensureGameFolder: mockEnsureGameFolder,
}));

describe("backups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listBackedUpGameNames", () => {
    it("returns game folder names", async () => {
      mockEnsureQSaveFolder.mockResolvedValueOnce("root-id");
      mockGetFolderNames.mockResolvedValueOnce(["Sims 4", "Elden Ring"]);

      const result = await listBackedUpGameNames();

      expect(result).toEqual(["Sims 4", "Elden Ring"]);
      expect(mockGetFolderNames).toHaveBeenCalledWith("root-id");
    });

    it("excludes system folders like devices", async () => {
      mockEnsureQSaveFolder.mockResolvedValueOnce("root-id");
      mockGetFolderNames.mockResolvedValueOnce([
        "Sims 4",
        "devices",
        "Elden Ring",
      ]);

      const result = await listBackedUpGameNames();

      expect(result).toEqual(["Sims 4", "Elden Ring"]);
    });

    it("returns empty array on error", async () => {
      mockEnsureQSaveFolder.mockRejectedValueOnce(new Error("fail"));

      const result = await listBackedUpGameNames();

      expect(result).toEqual([]);
    });
  });

  describe("listGameBackups", () => {
    it("returns backups in reverse order", async () => {
      mockEnsureGameFolder.mockResolvedValueOnce("game-folder");
      mockGetFilesInFolder.mockResolvedValueOnce([
        { id: "1", name: "old.zip", createdTime: "2024-01-01" },
        { id: "2", name: "new.zip", createdTime: "2024-01-02" },
      ]);

      const result = await listGameBackups("Sims 4");

      expect(result[0].id).toBe("2");
      expect(result[1].id).toBe("1");
      expect(mockEnsureGameFolder).toHaveBeenCalledWith("Sims 4");
    });

    it("wraps errors with gameName context", async () => {
      mockEnsureGameFolder.mockRejectedValueOnce(new Error("fail"));

      await expect(listGameBackups("Sims 4")).rejects.toThrow(
        'Failed to list backups for "Sims 4"',
      );
    });

    it("handles non-Error throw in list wrapping", async () => {
      mockEnsureGameFolder.mockRejectedValueOnce("string error");

      await expect(listGameBackups("Sims 4")).rejects.toThrow(
        'Failed to list backups for "Sims 4": string error',
      );
    });
  });

  describe("deleteGameBackup", () => {
    it("deletes file by ID", async () => {
      mockDeleteFile.mockResolvedValueOnce(undefined);

      await deleteGameBackup("file-123");

      expect(mockDeleteFile).toHaveBeenCalledWith("file-123");
    });

    it("wraps errors with fileId context", async () => {
      mockDeleteFile.mockRejectedValueOnce(new Error("delete failed"));

      await expect(deleteGameBackup("file-123")).rejects.toThrow(
        'Failed to delete backup "file-123"',
      );
    });

    it("handles non-Error throw in delete wrapping", async () => {
      mockDeleteFile.mockRejectedValueOnce("string error");

      await expect(deleteGameBackup("file-123")).rejects.toThrow(
        'Failed to delete backup "file-123": string error',
      );
    });
  });

  describe("uploadGameArchive", () => {
    beforeEach(() => {
      mockInvoke.mockResolvedValue({
        temp_path: "/tmp/qsave_upload_test.zip",
        content_hash: "abc123",
        file_size: 1024,
      });
    });

    it("creates zip file, uploads via postFile, and returns result", async () => {
      mockEnsureGameFolder.mockResolvedValueOnce("game-folder");
      mockGetFilesInFolder.mockResolvedValueOnce([]);
      mockPostFile.mockResolvedValueOnce({ fileId: "uploaded-id" });

      const result = await uploadGameArchive(
        "Sims 4",
        ["/saves"],
        ["/saves/file.sav"],
      );

      expect(result.fileId).toBe("uploaded-id");
      expect(result.contentHash).toBe("abc123");
      expect(mockInvoke).toHaveBeenCalledWith("create_zip_file", {
        savePaths: ["/saves"],
        files: ["/saves/file.sav"],
      });
      expect(mockPostFile).toHaveBeenCalledWith(
        "game-folder",
        expect.stringContaining("Sims 4_"),
        "/tmp/qsave_upload_test.zip",
        1024,
      );
    });

    it("deletes old saves when at limit", async () => {
      mockEnsureGameFolder.mockResolvedValueOnce("gf");
      const existingFiles = Array.from({ length: 5 }, (_, index) => ({
        id: `file-${index}`,
        name: `save-${index}.zip`,
        createdTime: "2024-01-01",
      }));
      mockGetFilesInFolder.mockResolvedValueOnce(existingFiles);
      mockDeleteFile.mockResolvedValue(undefined);
      mockPostFile.mockResolvedValueOnce({ fileId: "new-id" });

      const result = await uploadGameArchive("Game", ["/s"], ["/s/f"]);

      expect(result.fileId).toBe("new-id");
      expect(mockDeleteFile).toHaveBeenCalledWith("file-0");
    });

    it("propagates zip creation errors", async () => {
      mockInvoke.mockReset();
      mockInvoke.mockRejectedValueOnce(new Error("zip fail"));

      await expect(uploadGameArchive("Game", ["/s"], ["/s/f"])).rejects.toThrow(
        "zip fail",
      );
    });

    it("cleans up temp file when upload fails", async () => {
      mockEnsureGameFolder.mockRejectedValueOnce(new Error("folder fail"));

      await expect(uploadGameArchive("Game", ["/s"], ["/s/f"])).rejects.toThrow(
        "folder fail",
      );

      expect(mockInvoke).toHaveBeenCalledWith("delete_temp_file", {
        filePath: "/tmp/qsave_upload_test.zip",
      });
    });

    it("continues upload when cleanup of old saves fails", async () => {
      mockEnsureGameFolder.mockResolvedValueOnce("gf");
      mockGetFilesInFolder.mockRejectedValueOnce(new Error("list fail"));
      mockPostFile.mockResolvedValueOnce({ fileId: "uploaded-id" });

      const result = await uploadGameArchive("Game", ["/s"], ["/s/f"]);

      expect(result.fileId).toBe("uploaded-id");
    });
  });
});
