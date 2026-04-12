import { describe, it, expect, vi, beforeEach } from "vitest";
import { RECORD_STATUS } from "@/domain/types";
import { sims4Game } from "@/test/mocks/games";
import { restoreGame } from "./restore";

const defaultInvokeResults: Record<string, unknown> = {
  read_zip_meta_file: { platform: "macos", save_paths: ["/saves/sims4"] },
  extract_zip_file: { file_count: 3 },
  delete_temp_file: undefined,
};

const {
  mockInvoke,
  mockDownloadBackupToTempFile,
  mockAddSyncRecord,
  mockNotify,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(
    (command: string): Promise<unknown> =>
      Promise.resolve(defaultInvokeResults[command]),
  ),
  mockDownloadBackupToTempFile: vi.fn(() =>
    Promise.resolve({ tempPath: "/tmp/qsave_restore_abc.zip", fileSize: 1234 }),
  ),
  mockAddSyncRecord: vi.fn(),
  mockNotify: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@/services/drive/drive", () => ({
  downloadBackupToTempFile: mockDownloadBackupToTempFile,
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

    expect(mockDownloadBackupToTempFile).toHaveBeenCalledWith("backup-123");
  });

  it("passes the temp path to read_zip_meta_file and extract_zip_file", async () => {
    await restoreGame(sims4Game, "backup-123");

    expect(mockInvoke).toHaveBeenCalledWith("read_zip_meta_file", {
      zipPath: "/tmp/qsave_restore_abc.zip",
    });
    expect(mockInvoke).toHaveBeenCalledWith("extract_zip_file", {
      zipPath: "/tmp/qsave_restore_abc.zip",
      targetDirs: ["/saves/sims4"],
    });
  });

  it("deletes the downloaded temp file after a successful restore", async () => {
    await restoreGame(sims4Game, "backup-123");

    expect(mockInvoke).toHaveBeenCalledWith("delete_temp_file", {
      filePath: "/tmp/qsave_restore_abc.zip",
    });
  });

  it("deletes the downloaded temp file after a failed extraction", async () => {
    mockInvoke
      .mockResolvedValueOnce({
        platform: "macos",
        save_paths: ["/saves/sims4"],
      })
      .mockRejectedValueOnce(new Error("Extract failed"));

    await restoreGame(sims4Game, "backup-123");

    expect(mockInvoke).toHaveBeenCalledWith("delete_temp_file", {
      filePath: "/tmp/qsave_restore_abc.zip",
    });
  });

  it("does not call delete_temp_file when the download itself fails", async () => {
    mockDownloadBackupToTempFile.mockRejectedValueOnce(
      new Error("Download failed"),
    );

    await restoreGame(sims4Game, "backup-123");

    const deleteCalls = mockInvoke.mock.calls.filter(
      ([command]) => command === "delete_temp_file",
    );
    expect(deleteCalls).toHaveLength(0);
  });

  it("swallows temp file cleanup failures", async () => {
    mockInvoke
      .mockResolvedValueOnce({
        platform: "macos",
        save_paths: ["/saves/sims4"],
      })
      .mockResolvedValueOnce({ file_count: 3 })
      .mockRejectedValueOnce(new Error("Cleanup failed"));

    const record = await restoreGame(sims4Game, "backup-123");

    // Cleanup failures must not mask a successful restore.
    expect(record.status).toBe(RECORD_STATUS.success);
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
    mockDownloadBackupToTempFile.mockRejectedValueOnce(
      new Error("Download failed"),
    );

    await restoreGame(sims4Game, "backup-123");

    expect(mockNotify).toHaveBeenCalledWith(
      "QSave",
      "notifications.restoreFailed",
    );
  });

  it("returns an error record when download fails", async () => {
    mockDownloadBackupToTempFile.mockRejectedValueOnce(
      new Error("Download failed"),
    );

    const record = await restoreGame(sims4Game, "backup-123");

    expect(record.status).toBe(RECORD_STATUS.error);
    expect(record.error).toBe("Download failed");
    expect(record.type).toBe("restore");
  });

  it("handles non-Error rejection in error record", async () => {
    mockDownloadBackupToTempFile.mockRejectedValueOnce("string error");

    const record = await restoreGame(sims4Game, "backup-123");

    expect(record.status).toBe(RECORD_STATUS.error);
    expect(record.error).toBe("string error");
  });

  it("uses only first save path when meta has no save_paths", async () => {
    mockInvoke
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ file_count: 1 });

    const record = await restoreGame(sims4Game, "backup-123");

    expect(record.status).toBe(RECORD_STATUS.success);
    expect(mockInvoke).toHaveBeenCalledWith("extract_zip_file", {
      zipPath: "/tmp/qsave_restore_abc.zip",
      targetDirs: ["/saves/sims4"],
    });
  });

  it("throws when game has no save paths", async () => {
    const noPathGame = { ...sims4Game, savePaths: [] as string[] };
    mockInvoke.mockResolvedValueOnce(null);

    const record = await restoreGame(noPathGame, "backup-123");

    expect(record.status).toBe(RECORD_STATUS.error);
    expect(record.error).toBe("No save paths available for restore");
  });
});
