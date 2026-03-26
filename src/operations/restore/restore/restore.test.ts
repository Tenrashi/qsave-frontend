import { describe, it, expect, vi, beforeEach } from "vitest";
import { RECORD_STATUS } from "@/domain/types";
import { sims4Game } from "@/test/mocks/games";
import { restoreGame } from "./restore";

const { mockInvoke, mockGetBackupFile, mockAddSyncRecord, mockNotify } =
  vi.hoisted(() => ({
    mockInvoke: vi.fn((command: string): Promise<unknown> => {
      if (command === "read_zip_meta")
        return Promise.resolve({
          platform: "macos",
          save_paths: ["/saves/sims4"],
        });
      if (command === "extract_zip") return Promise.resolve({ file_count: 3 });
      return Promise.resolve();
    }),
    mockGetBackupFile: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    mockAddSyncRecord: vi.fn(),
    mockNotify: vi.fn(),
  }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@/services/drive/drive", () => ({
  getBackupFile: mockGetBackupFile,
}));

vi.mock("@/lib/store/store", () => ({
  addSyncRecord: mockAddSyncRecord,
}));

vi.mock("@/lib/notify/notify", () => ({
  notify: mockNotify,
}));

describe("restoreGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a success record with file count", async () => {
    const record = await restoreGame(sims4Game, "backup-123");

    expect(record.status).toBe(RECORD_STATUS.success);
    expect(record.revisionCount).toBe(3);
    expect(record.type).toBe("restore");
    expect(record.driveFileId).toBe("backup-123");
  });

  it("downloads the backup by id", async () => {
    await restoreGame(sims4Game, "backup-123");

    expect(mockGetBackupFile).toHaveBeenCalledWith("backup-123");
  });

  it("persists a restore sync record", async () => {
    await restoreGame(sims4Game, "backup-123");

    expect(mockAddSyncRecord.mock.calls[0][0]).toMatchObject({
      gameName: "The Sims 4",
      type: "restore",
      status: RECORD_STATUS.success,
    });
  });

  it("sends a translated notification on success", async () => {
    await restoreGame(sims4Game, "backup-123");

    expect(mockNotify).toHaveBeenCalledWith(
      "QSave",
      "notifications.restoreSuccess",
    );
  });

  it("sends a translated notification on failure", async () => {
    mockGetBackupFile.mockRejectedValueOnce(new Error("Download failed"));

    await restoreGame(sims4Game, "backup-123");

    expect(mockNotify).toHaveBeenCalledWith(
      "QSave",
      "notifications.restoreFailed",
    );
  });

  it("returns an error record when download fails", async () => {
    mockGetBackupFile.mockRejectedValueOnce(new Error("Download failed"));

    const record = await restoreGame(sims4Game, "backup-123");

    expect(record.status).toBe(RECORD_STATUS.error);
    expect(record.error).toBe("Download failed");
    expect(record.type).toBe("restore");
  });

  it("handles non-Error rejection in error record", async () => {
    mockGetBackupFile.mockRejectedValueOnce("string error");

    const record = await restoreGame(sims4Game, "backup-123");

    expect(record.status).toBe(RECORD_STATUS.error);
    expect(record.error).toBe("string error");
  });

  it("uses only first save path when meta has no save_paths", async () => {
    mockInvoke
      .mockResolvedValueOnce(null) // read_zip_meta
      .mockResolvedValueOnce({ file_count: 1 }); // extract_zip

    const record = await restoreGame(sims4Game, "backup-123");

    expect(record.status).toBe(RECORD_STATUS.success);
    expect(mockInvoke).toHaveBeenCalledWith("extract_zip", {
      zipBytes: expect.any(Array),
      targetDirs: ["/saves/sims4"],
    });
  });

  it("throws when game has no save paths", async () => {
    const noPathGame = { ...sims4Game, savePaths: [] as string[] };
    mockInvoke.mockResolvedValueOnce(null); // read_zip_meta

    const record = await restoreGame(noPathGame, "backup-123");

    expect(record.status).toBe(RECORD_STATUS.error);
    expect(record.error).toBe("No save paths available for restore");
  });
});
