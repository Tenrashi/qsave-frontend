import { describe, it, expect, vi, beforeEach } from "vitest";
import { RECORD_STATUS } from "@/domain/types";
import { sims4Game, manualGame } from "@/test/mocks/games";
import { syncGame, syncAllGames } from "./sync";

const {
  mockUploadGameArchive,
  mockSaveDeviceSync,
  mockRescanGame,
  mockAddSyncRecord,
  mockGetDeviceId,
  mockNotify,
  mockMarkGameBackedUp,
} = vi.hoisted(() => ({
  mockUploadGameArchive: vi.fn(() =>
    Promise.resolve({ fileId: "drive-file-123", contentHash: "hash-abc" }),
  ),
  mockSaveDeviceSync: vi.fn(() => Promise.resolve()),
  mockRescanGame: vi.fn((game: unknown) => Promise.resolve(game)),
  mockAddSyncRecord: vi.fn(),
  mockGetDeviceId: vi.fn(() => Promise.resolve("test-device-id")),
  mockNotify: vi.fn(),
  mockMarkGameBackedUp: vi.fn(),
}));

vi.mock("@/operations/drive/backups/backups", () => ({
  uploadGameArchive: mockUploadGameArchive,
}));

vi.mock("@/operations/devices/devices", () => ({
  saveDeviceSync: mockSaveDeviceSync,
}));

vi.mock("@/operations/scanner/scanner/scanner", () => ({
  rescanGame: mockRescanGame,
}));

vi.mock("@/lib/store/store", () => ({
  addSyncRecord: mockAddSyncRecord,
  getDeviceId: mockGetDeviceId,
}));

vi.mock("@/lib/notify/notify", () => ({
  notify: mockNotify,
}));

vi.mock("@/stores/sync", () => ({
  useSyncStore: {
    getState: () => ({
      markGameBackedUp: mockMarkGameBackedUp,
    }),
  },
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

  it("sends a translated notification on success", async () => {
    await syncGame(sims4Game);

    expect(mockNotify).toHaveBeenCalledWith(
      "QSave",
      "notifications.syncSuccess",
    );
  });

  it("sends a translated notification on failure", async () => {
    mockUploadGameArchive.mockRejectedValueOnce(new Error("Network error"));

    await syncGame(sims4Game);

    expect(mockNotify).toHaveBeenCalledWith(
      "QSave",
      "notifications.syncFailed",
    );
  });

  it("returns an error record when upload fails", async () => {
    mockUploadGameArchive.mockRejectedValueOnce(new Error("Network error"));

    const record = await syncGame(sims4Game);

    expect(record.status).toBe(RECORD_STATUS.error);
    expect(record.error).toBe("Network error");
  });

  it("handles non-Error rejection in error record", async () => {
    mockUploadGameArchive.mockRejectedValueOnce("string error");

    const record = await syncGame(sims4Game);

    expect(record.status).toBe(RECORD_STATUS.error);
    expect(record.error).toBe("string error");
  });

  it("saves device sync info with content hash", async () => {
    await syncGame(sims4Game);

    expect(mockGetDeviceId).toHaveBeenCalledOnce();
    expect(mockSaveDeviceSync).toHaveBeenCalledWith(
      "test-device-id",
      sims4Game.name,
      sims4Game.savePaths,
      "hash-abc",
    );
  });

  it("returns contentHash in sync result", async () => {
    const record = await syncGame(sims4Game);

    expect(record.contentHash).toBe("hash-abc");
  });

  it("does not block sync when device sync update fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockSaveDeviceSync.mockRejectedValueOnce(new Error("Drive error"));

    const record = await syncGame(manualGame);

    expect(record.status).toBe(RECORD_STATUS.success);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("marks game as backed up after successful sync", async () => {
    await syncGame(sims4Game);

    expect(mockMarkGameBackedUp).toHaveBeenCalledWith("The Sims 4");
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
