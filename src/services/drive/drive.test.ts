import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  postFolder,
  getFolder,
  getFile,
  getFilesInFolder,
  deleteFile,
  getBackupFile,
  postFile,
  getFolderNames,
} from "./drive";

const { mockFetch, mockGetValidToken } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockGetValidToken: vi.fn(() => Promise.resolve("test-token")),
}));

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: mockFetch,
}));

vi.mock("@/operations/auth/auth/auth", () => ({
  getValidToken: mockGetValidToken,
}));

vi.mock("@/lib/drive/multipart/multipart", () => ({
  buildMultipartBody: vi.fn(() => new Uint8Array([1, 2, 3])),
}));

const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
});

const errorResponse = (status = 500) => ({
  ok: false,
  status,
  statusText: "Error",
  json: () => Promise.resolve({}),
  text: () => Promise.resolve("error body"),
});

describe("drive service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("postFolder", () => {
    it("creates a folder and returns its ID", async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ id: "new-folder-id" }));

      const result = await postFolder("MyFolder", "root");

      expect(result).toBe("new-folder-id");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/files"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403));

      await expect(postFolder("F", "root")).rejects.toThrow(
        "Failed to create folder",
      );
    });
  });

  describe("getFolder", () => {
    it("returns folder ID when found", async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "folder-id" }] }),
      );

      const result = await getFolder("QSave", "root");

      expect(result).toBe("folder-id");
    });

    it("returns null when not found", async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ files: [] }));

      const result = await getFolder("Missing", "root");

      expect(result).toBeNull();
    });

    it("returns null on error response", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500));

      const result = await getFolder("QSave", "root");

      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await getFolder("QSave", "root");

      expect(result).toBeNull();
    });

    it("escapes single quotes in folder name", async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ files: [] }));

      await getFolder("Tom Clancy's", "root");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain(encodeURIComponent("Tom Clancy\\'s"));
    });
  });

  describe("getFile", () => {
    it("returns file ID when found", async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ id: "file-id" }] }),
      );

      const result = await getFile("devices.json", "folder-id");

      expect(result).toBe("file-id");
    });

    it("returns null when not found", async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ files: [] }));

      const result = await getFile("missing.json", "folder-id");

      expect(result).toBeNull();
    });
  });

  describe("getFilesInFolder", () => {
    it("returns list of files", async () => {
      const files = [
        { id: "1", name: "a.zip", createdTime: "2024-01-01" },
        { id: "2", name: "b.zip", createdTime: "2024-01-02" },
      ];
      mockFetch.mockResolvedValueOnce(okResponse({ files }));

      const result = await getFilesInFolder("folder-id");

      expect(result).toEqual(files);
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500));

      await expect(getFilesInFolder("folder-id")).rejects.toThrow(
        "Failed to list files",
      );
    });
  });

  describe("deleteFile", () => {
    it("sends DELETE request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(""),
      });

      await deleteFile("file-123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/files/file-123"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("getBackupFile", () => {
    it("returns file as Uint8Array", async () => {
      const buffer = new ArrayBuffer(4);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(buffer),
      });

      const result = await getBackupFile("file-123");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(4);
    });

    it("wraps errors with fileId context", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404));

      await expect(getBackupFile("file-123")).rejects.toThrow(
        'Failed to download backup "file-123"',
      );
    });
  });

  describe("postFile", () => {
    it("uploads file and returns fileId", async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ id: "uploaded-id" }));

      const result = await postFile(
        "folder-id",
        "save.zip",
        new Uint8Array([1]),
      );

      expect(result.fileId).toBe("uploaded-id");
    });

    it("wraps errors with fileName context", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500));

      await expect(
        postFile("folder-id", "save.zip", new Uint8Array([1])),
      ).rejects.toThrow('Failed to upload file "save.zip"');
    });
  });

  describe("getFolderNames", () => {
    it("returns folder names", async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({ files: [{ name: "Sims 4" }, { name: "Elden Ring" }] }),
      );

      const result = await getFolderNames("parent-id");

      expect(result).toEqual(["Sims 4", "Elden Ring"]);
    });

    it("returns empty array on error", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500));

      const result = await getFolderNames("parent-id");

      expect(result).toEqual([]);
    });
  });
});
