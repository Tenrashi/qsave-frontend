import { describe, it, expect, vi, beforeEach } from "vitest";
import { RECORD_STATUS } from "@/domain/types";
import { sims4Game } from "@/test/mocks/games";
import { syncGame, syncAllGames } from "./sync";

vi.mock("@/services/drive/drive", () => ({
  uploadGameArchive: vi.fn(() => Promise.resolve({ fileId: "drive-file-123" })),
}));

vi.mock("@/lib/store/store", () => ({
  addSyncRecord: vi.fn(),
}));

vi.mock("@/lib/notify/notify", () => ({
  notify: vi.fn(),
}));

describe("syncGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a success record on successful sync", async () => {
    const record = await syncGame(sims4Game);

    expect(record.gameName).toBe("The Sims 4");
    expect(record.status).toBe(RECORD_STATUS.success);
    expect(record.driveFileId).toBe("drive-file-123");
  });

  it("persists the sync record", async () => {
    const { addSyncRecord } = await import("@/lib/store/store");
    await syncGame(sims4Game);

    expect(addSyncRecord).toHaveBeenCalledOnce();
    expect(vi.mocked(addSyncRecord).mock.calls[0][0]).toMatchObject({
      gameName: "The Sims 4",
      status: RECORD_STATUS.success,
    });
  });

  it("sends a notification after sync", async () => {
    const { notify } = await import("@/lib/notify/notify");
    await syncGame(sims4Game);

    expect(notify).toHaveBeenCalledOnce();
  });

  it("returns an error record when upload fails", async () => {
    const { uploadGameArchive } = await import("@/services/drive/drive");
    vi.mocked(uploadGameArchive).mockRejectedValueOnce(new Error("Network error"));

    const record = await syncGame(sims4Game);

    expect(record.status).toBe(RECORD_STATUS.error);
    expect(record.error).toBe("Network error");
  });
});

describe("syncAllGames", () => {
  it("syncs each game sequentially and returns all records", async () => {
    vi.clearAllMocks();
    const { uploadGameArchive } = await import("@/services/drive/drive");
    const records = await syncAllGames([sims4Game, sims4Game]);

    expect(records).toHaveLength(2);
    expect(uploadGameArchive).toHaveBeenCalledTimes(2);
  });
});
