import { describe, it, expect, vi, beforeEach } from "vitest";
import { RECORD_STATUS } from "@/domain/types";
import { sims4Game } from "@/test/mocks/games";
import { restoreGame } from "./restore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn((command: string) => {
    if (command === "read_zip_meta") return Promise.resolve({ platform: "macos", save_paths: ["/saves/sims4"] });
    if (command === "extract_zip") return Promise.resolve({ file_count: 3 });
    return Promise.resolve();
  }),
}));

vi.mock("@/services/drive/drive", () => ({
  downloadBackup: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
}));

vi.mock("@/lib/store/store", () => ({
  addSyncRecord: vi.fn(),
}));

vi.mock("@/lib/notify/notify", () => ({
  notify: vi.fn(),
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
    const { downloadBackup } = await import("@/services/drive/drive");
    await restoreGame(sims4Game, "backup-123");

    expect(downloadBackup).toHaveBeenCalledWith("backup-123");
  });

  it("persists a restore sync record", async () => {
    const { addSyncRecord } = await import("@/lib/store/store");
    await restoreGame(sims4Game, "backup-123");

    expect(vi.mocked(addSyncRecord).mock.calls[0][0]).toMatchObject({
      gameName: "The Sims 4",
      type: "restore",
      status: RECORD_STATUS.success,
    });
  });

  it("returns an error record when download fails", async () => {
    const { downloadBackup } = await import("@/services/drive/drive");
    vi.mocked(downloadBackup).mockRejectedValueOnce(new Error("Download failed"));

    const record = await restoreGame(sims4Game, "backup-123");

    expect(record.status).toBe(RECORD_STATUS.error);
    expect(record.error).toBe("Download failed");
    expect(record.type).toBe("restore");
  });
});
