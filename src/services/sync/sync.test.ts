import { describe, it, expect, vi, beforeEach } from "vitest";
import { RECORD_STATUS } from "@/domain/types";
import { sims4Game } from "@/test/mocks/games";
import { syncGame, syncAllGames } from "./sync";

const { mockUploadGameArchive, mockAddSyncRecord, mockNotify } = vi.hoisted(() => ({
  mockUploadGameArchive: vi.fn(() => Promise.resolve({ fileId: "drive-file-123" })),
  mockAddSyncRecord: vi.fn(),
  mockNotify: vi.fn(),
}));

vi.mock("@/services/drive/drive", () => ({
  uploadGameArchive: mockUploadGameArchive,
}));

vi.mock("@/lib/store/store", () => ({
  addSyncRecord: mockAddSyncRecord,
}));

vi.mock("@/lib/notify/notify", () => ({
  notify: mockNotify,
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
    await syncGame(sims4Game);

    expect(mockAddSyncRecord).toHaveBeenCalledOnce();
    expect(mockAddSyncRecord.mock.calls[0][0]).toMatchObject({
      gameName: "The Sims 4",
      status: RECORD_STATUS.success,
    });
  });

  it("sends a notification after sync", async () => {
    await syncGame(sims4Game);

    expect(mockNotify).toHaveBeenCalledOnce();
  });

  it("returns an error record when upload fails", async () => {
    mockUploadGameArchive.mockRejectedValueOnce(new Error("Network error"));

    const record = await syncGame(sims4Game);

    expect(record.status).toBe(RECORD_STATUS.error);
    expect(record.error).toBe("Network error");
  });
});

describe("syncAllGames", () => {
  it("syncs each game sequentially and returns all records", async () => {
    vi.clearAllMocks();
    const records = await syncAllGames([sims4Game, sims4Game]);

    expect(records).toHaveLength(2);
    expect(mockUploadGameArchive).toHaveBeenCalledTimes(2);
  });
});
