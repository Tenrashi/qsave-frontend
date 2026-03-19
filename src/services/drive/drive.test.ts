import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildMultipartBody,
  ensureQSaveFolder,
  ensureGameFolder,
  listBackedUpGameNames,
  listGameBackups,
  downloadBackup,
  uploadGameArchive,
} from "./drive";

const {
  mockInvoke,
  mockFetch,
  mockGetValidToken,
  mockGetDriveFolderId,
  mockSetDriveFolderId,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockFetch: vi.fn(),
  mockGetValidToken: vi.fn(() => Promise.resolve("test-token")),
  mockGetDriveFolderId: vi.fn(),
  mockSetDriveFolderId: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: mockFetch,
}));

vi.mock("@/services/auth/auth", () => ({
  getValidToken: mockGetValidToken,
}));

vi.mock("@/lib/store/store", () => ({
  getDriveFolderId: mockGetDriveFolderId,
  setDriveFolderId: mockSetDriveFolderId,
}));

const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
});

const errorResponse = (status = 500) => ({
  ok: false,
  status,
  statusText: "Error",
  json: () => Promise.resolve({}),
  text: () => Promise.resolve("error body"),
});

describe("drive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildMultipartBody", () => {
    const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

    it("wraps metadata and file content with boundary markers", () => {
      const metadata = JSON.stringify({ name: "test.zip" });
      const content = new TextEncoder().encode("file-data");
      const result = decode(
        buildMultipartBody("test_boundary", metadata, content),
      );

      expect(result).toContain("--test_boundary\r\n");
      expect(result).toContain(metadata);
      expect(result).toContain("file-data");
      expect(result.endsWith("\r\n--test_boundary--")).toBe(true);
    });
  });

  describe("ensureQSaveFolder", () => {
    it("returns cached folder ID when it matches Drive", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce("cached-id");
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "cached-id" }] }),
      );

      const result = await ensureQSaveFolder();

      expect(result).toBe("cached-id");
    });

    it("finds existing folder when cache misses", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "existing-id" }] }),
      );

      const result = await ensureQSaveFolder();

      expect(result).toBe("existing-id");
      expect(mockSetDriveFolderId).toHaveBeenCalledWith(
        "__root__",
        "existing-id",
      );
    });

    it("creates folder when not found", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce(undefined);
      mockFetch
        .mockResolvedValueOnce(okResponse({ files: [] }))
        .mockResolvedValueOnce(okResponse({ id: "new-id" }));

      const result = await ensureQSaveFolder();

      expect(result).toBe("new-id");
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

    it("re-fetches when cached ID doesn't match Drive", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce("stale-cached-id");
      // findFolder returns different ID than cached
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "different-id" }] }),
      );
      // second findFolder call (after cache miss path)
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "different-id" }] }),
      );

      const result = await ensureQSaveFolder();

      expect(result).toBe("different-id");
    });
  });

  describe("ensureGameFolder", () => {
    beforeEach(() => {
      // Mock ensureQSaveFolder to return root ID
      mockGetDriveFolderId.mockResolvedValueOnce("root-id");
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "root-id" }] }),
      );
    });

    it("returns cached game folder ID when valid", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce("game-folder");
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "game-folder" }] }),
      );

      const result = await ensureGameFolder("Sims 4");

      expect(result).toBe("game-folder");
    });

    it("finds existing game folder", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce(undefined);
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "found-id" }] }),
      );

      const result = await ensureGameFolder("Sims 4");

      expect(result).toBe("found-id");
    });

    it("creates game folder when not found", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce(undefined);
      mockFetch
        .mockResolvedValueOnce(okResponse({ files: [] }))
        .mockResolvedValueOnce(okResponse({ id: "created-id" }));

      const result = await ensureGameFolder("Sims 4");

      expect(result).toBe("created-id");
    });
  });

  describe("listBackedUpGameNames", () => {
    it("returns game folder names", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce("root-id");
      mockFetch
        .mockResolvedValueOnce(okResponse({ files: [{ id: "root-id" }] }))
        .mockResolvedValueOnce(
          okResponse({ files: [{ name: "Sims 4" }, { name: "Elden Ring" }] }),
        );

      const result = await listBackedUpGameNames();

      expect(result).toEqual(["Sims 4", "Elden Ring"]);
    });

    it("returns empty array on error", async () => {
      mockGetDriveFolderId.mockRejectedValueOnce(new Error("fail"));

      const result = await listBackedUpGameNames();

      expect(result).toEqual([]);
    });

    it("returns empty array on non-ok response", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce("root-id");
      mockFetch
        .mockResolvedValueOnce(okResponse({ files: [{ id: "root-id" }] }))
        .mockResolvedValueOnce(errorResponse(403));

      const result = await listBackedUpGameNames();

      expect(result).toEqual([]);
    });
  });

  describe("listGameBackups", () => {
    it("returns backups in reverse order", async () => {
      // ensureQSaveFolder
      mockGetDriveFolderId.mockResolvedValueOnce("root-id");
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "root-id" }] }),
      );
      // ensureGameFolder
      mockGetDriveFolderId.mockResolvedValueOnce("game-folder");
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "game-folder" }] }),
      );
      // listFilesInFolder
      mockFetch.mockResolvedValueOnce(
        okResponse({
          files: [
            { id: "1", name: "old.zip", createdTime: "2024-01-01" },
            { id: "2", name: "new.zip", createdTime: "2024-01-02" },
          ],
        }),
      );

      const result = await listGameBackups("Sims 4");

      expect(result[0].id).toBe("2");
      expect(result[1].id).toBe("1");
    });
  });

  describe("downloadBackup", () => {
    it("returns file as Uint8Array", async () => {
      const buffer = new ArrayBuffer(4);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(buffer),
      });

      const result = await downloadBackup("file-123");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(4);
    });

    it("wraps errors with fileId context", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404));

      await expect(downloadBackup("file-123")).rejects.toThrow(
        'Failed to download backup "file-123"',
      );
    });

    it("handles non-Error throw in wrapping", async () => {
      mockGetValidToken.mockRejectedValueOnce("auth expired");

      await expect(downloadBackup("file-123")).rejects.toThrow(
        'Failed to download backup "file-123"',
      );
    });
  });

  describe("uploadGameArchive", () => {
    it("creates zip, uploads, and returns fileId", async () => {
      mockInvoke.mockResolvedValueOnce([1, 2, 3]);
      // ensureQSaveFolder
      mockGetDriveFolderId.mockResolvedValueOnce("root-id");
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "root-id" }] }),
      );
      // ensureGameFolder
      mockGetDriveFolderId.mockResolvedValueOnce("game-folder");
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "game-folder" }] }),
      );
      // listFilesInFolder (cleanup)
      mockFetch.mockResolvedValueOnce(okResponse({ files: [] }));
      // upload
      mockFetch.mockResolvedValueOnce(okResponse({ id: "uploaded-id" }));

      const result = await uploadGameArchive(
        "Sims 4",
        ["/saves"],
        ["/saves/file.sav"],
      );

      expect(result.fileId).toBe("uploaded-id");
      expect(mockInvoke).toHaveBeenCalledWith("create_zip", {
        savePaths: ["/saves"],
        files: ["/saves/file.sav"],
      });
    });

    it("deletes old saves when at limit", async () => {
      mockInvoke.mockResolvedValueOnce([1]);
      // ensureQSaveFolder
      mockGetDriveFolderId.mockResolvedValueOnce("root-id");
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "root-id" }] }),
      );
      // ensureGameFolder
      mockGetDriveFolderId.mockResolvedValueOnce("gf");
      mockFetch.mockResolvedValueOnce(okResponse({ files: [{ id: "gf" }] }));
      // listFilesInFolder - 5 existing files (at limit)
      const existingFiles = Array.from({ length: 5 }, (_, index) => ({
        id: `file-${index}`,
        name: `save-${index}.zip`,
        createdTime: "2024-01-01",
      }));
      mockFetch.mockResolvedValueOnce(okResponse({ files: existingFiles }));
      // deleteFile for oldest
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(""),
      });
      // upload
      mockFetch.mockResolvedValueOnce(okResponse({ id: "new-id" }));

      const result = await uploadGameArchive("Game", ["/s"], ["/s/f"]);

      expect(result.fileId).toBe("new-id");
    });

    it("wraps errors with gameName context", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("zip fail"));

      await expect(uploadGameArchive("Game", ["/s"], ["/s/f"])).rejects.toThrow(
        'Failed to upload archive for "Game"',
      );
    });

    it("handles non-Error throw in upload wrapping", async () => {
      mockInvoke.mockRejectedValueOnce("string error");

      await expect(uploadGameArchive("Game", ["/s"], ["/s/f"])).rejects.toThrow(
        'Failed to upload archive for "Game"',
      );
    });

    it("continues upload when cleanup fails", async () => {
      mockInvoke.mockResolvedValueOnce([1]);
      // ensureQSaveFolder
      mockGetDriveFolderId.mockResolvedValueOnce("root-id");
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "root-id" }] }),
      );
      // ensureGameFolder
      mockGetDriveFolderId.mockResolvedValueOnce("gf");
      mockFetch.mockResolvedValueOnce(okResponse({ files: [{ id: "gf" }] }));
      // listFilesInFolder throws
      mockFetch.mockResolvedValueOnce(errorResponse(500));
      // upload still succeeds
      mockFetch.mockResolvedValueOnce(okResponse({ id: "uploaded-id" }));

      const result = await uploadGameArchive("Game", ["/s"], ["/s/f"]);

      expect(result.fileId).toBe("uploaded-id");
    });
  });

  describe("ensureGameFolder errors", () => {
    it("wraps errors with gameName context", async () => {
      // ensureQSaveFolder succeeds
      mockGetDriveFolderId.mockResolvedValueOnce("root-id");
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "root-id" }] }),
      );
      // getDriveFolderId for game throws
      mockGetDriveFolderId.mockRejectedValueOnce(new Error("store fail"));

      await expect(ensureGameFolder("Sims 4")).rejects.toThrow(
        'Failed to ensure game folder "Sims 4"',
      );
    });

    it("handles non-Error throw in game folder wrapping", async () => {
      mockGetDriveFolderId.mockResolvedValueOnce("root-id");
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "root-id" }] }),
      );
      mockGetDriveFolderId.mockRejectedValueOnce("string error");

      await expect(ensureGameFolder("Sims 4")).rejects.toThrow(
        'Failed to ensure game folder "Sims 4"',
      );
    });
  });

  describe("listGameBackups errors", () => {
    it("wraps errors with gameName context", async () => {
      mockGetDriveFolderId.mockRejectedValueOnce(new Error("fail"));

      await expect(listGameBackups("Sims 4")).rejects.toThrow(
        'Failed to list backups for "Sims 4"',
      );
    });
  });
});
