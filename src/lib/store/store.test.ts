import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAuthState,
  setAuthState,
  clearAuth,
  getSyncHistory,
  addSyncRecord,
  getDriveFolderId,
  setDriveFolderId,
  getWatchedGames,
  setWatchedGames,
  getManualGames,
  setManualGames,
  addManualGame,
  removeManualGame,
  getSyncFingerprints,
  setSyncFingerprint,
  getHideSteamCloud,
  setHideSteamCloud,
  setAutostart,
} from "./store";
import type { SyncRecord, GameSyncFingerprint } from "@/domain/types";

const { mockGet, mockSet, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(() =>
    Promise.resolve({
      get: mockGet,
      set: mockSet,
      delete: mockDelete,
    }),
  ),
}));

describe("store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("auth", () => {
    it("returns persisted auth state", async () => {
      const auth = { isAuthenticated: true, email: "a@b.com" };
      mockGet.mockResolvedValueOnce(auth);

      expect(await getAuthState()).toEqual(auth);
    });

    it("returns default when no auth stored", async () => {
      mockGet.mockResolvedValueOnce(null);

      expect(await getAuthState()).toEqual({ isAuthenticated: false });
    });

    it("returns default on error", async () => {
      mockGet.mockRejectedValueOnce(new Error("fail"));

      expect(await getAuthState()).toEqual({ isAuthenticated: false });
    });

    it("sets auth state", async () => {
      const auth = { isAuthenticated: true, email: "a@b.com" };
      await setAuthState(auth);

      expect(mockSet).toHaveBeenCalledWith("auth", auth);
    });

    it("does not throw on set error", async () => {
      mockSet.mockRejectedValueOnce(new Error("fail"));

      await expect(
        setAuthState({ isAuthenticated: false }),
      ).resolves.toBeUndefined();
    });

    it("clears auth state", async () => {
      await clearAuth();

      expect(mockDelete).toHaveBeenCalledWith("auth");
    });

    it("does not throw on clear error", async () => {
      mockDelete.mockRejectedValueOnce(new Error("fail"));

      await expect(clearAuth()).resolves.toBeUndefined();
    });
  });

  describe("sync history", () => {
    it("returns persisted history", async () => {
      const records = [{ id: "1" }];
      mockGet.mockResolvedValueOnce(records);

      expect(await getSyncHistory()).toEqual(records);
    });

    it("returns empty array when no history", async () => {
      mockGet.mockResolvedValueOnce(null);

      expect(await getSyncHistory()).toEqual([]);
    });

    it("returns empty array on error", async () => {
      mockGet.mockRejectedValueOnce(new Error("fail"));

      expect(await getSyncHistory()).toEqual([]);
    });

    it("prepends record to history", async () => {
      mockGet.mockResolvedValueOnce([{ id: "old" }]);

      await addSyncRecord({ id: "new" } as SyncRecord);

      expect(mockSet).toHaveBeenCalledWith(
        "syncHistory",
        expect.arrayContaining([{ id: "new" }, { id: "old" }]),
      );
    });

    it("truncates history at max records", async () => {
      const existing = Array.from({ length: 100 }, (_, index) => ({
        id: String(index),
      }));
      mockGet.mockResolvedValueOnce(existing);

      await addSyncRecord({ id: "new" } as SyncRecord);

      const saved = mockSet.mock.calls[0][1] as SyncRecord[];
      expect(saved).toHaveLength(100);
      expect(saved[0]).toEqual({ id: "new" });
    });
  });

  describe("drive folder IDs", () => {
    it("returns cached folder ID", async () => {
      mockGet.mockResolvedValueOnce({ "Sims 4": "folder-123" });

      expect(await getDriveFolderId("Sims 4")).toBe("folder-123");
    });

    it("returns undefined when not cached", async () => {
      mockGet.mockResolvedValueOnce(null);

      expect(await getDriveFolderId("Sims 4")).toBeUndefined();
    });

    it("sets folder ID in existing map", async () => {
      mockGet.mockResolvedValueOnce({ existing: "abc" });

      await setDriveFolderId("new", "def");

      expect(mockSet).toHaveBeenCalledWith("driveFolders", {
        existing: "abc",
        new: "def",
      });
    });

    it("creates map when none exists", async () => {
      mockGet.mockResolvedValueOnce(null);

      await setDriveFolderId("game", "id");

      expect(mockSet).toHaveBeenCalledWith("driveFolders", { game: "id" });
    });
  });

  describe("watched games", () => {
    it("returns persisted watched games", async () => {
      mockGet.mockResolvedValueOnce(["Sims 4"]);

      expect(await getWatchedGames()).toEqual(["Sims 4"]);
    });

    it("returns empty array when none stored", async () => {
      mockGet.mockResolvedValueOnce(null);

      expect(await getWatchedGames()).toEqual([]);
    });

    it("persists watched game names", async () => {
      await setWatchedGames(["Sims 4", "Elden Ring"]);

      expect(mockSet).toHaveBeenCalledWith("watchedGames", [
        "Sims 4",
        "Elden Ring",
      ]);
    });
  });

  describe("manual games", () => {
    it("returns persisted manual games", async () => {
      const games = [{ name: "Game", paths: ["/a"] }];
      mockGet.mockResolvedValueOnce(games);

      expect(await getManualGames()).toEqual(games);
    });

    it("returns empty array when none stored", async () => {
      mockGet.mockResolvedValueOnce(null);

      expect(await getManualGames()).toEqual([]);
    });

    it("persists manual games list", async () => {
      const games = [{ name: "Game", paths: ["/a"] }];
      await setManualGames(games);

      expect(mockSet).toHaveBeenCalledWith("manualGames", games);
    });

    it("adds a new manual game", async () => {
      mockGet.mockResolvedValueOnce([]);

      await addManualGame("New Game", ["/saves"]);

      expect(mockSet).toHaveBeenCalledWith("manualGames", [
        { name: "New Game", paths: ["/saves"] },
      ]);
    });

    it("updates existing manual game by name", async () => {
      mockGet.mockResolvedValueOnce([{ name: "Game", paths: ["/old"] }]);

      await addManualGame("Game", ["/new"]);

      expect(mockSet).toHaveBeenCalledWith("manualGames", [
        { name: "Game", paths: ["/new"] },
      ]);
    });

    it("removes manual game by name", async () => {
      mockGet.mockResolvedValueOnce([
        { name: "Keep", paths: ["/a"] },
        { name: "Remove", paths: ["/b"] },
      ]);

      await removeManualGame("Remove");

      expect(mockSet).toHaveBeenCalledWith("manualGames", [
        { name: "Keep", paths: ["/a"] },
      ]);
    });
  });

  describe("hideSteamCloud preference", () => {
    it("returns persisted value", async () => {
      mockGet.mockResolvedValueOnce(true);

      expect(await getHideSteamCloud()).toBe(true);
    });

    it("returns false when not stored", async () => {
      mockGet.mockResolvedValueOnce(null);

      expect(await getHideSteamCloud()).toBe(false);
    });

    it("returns false on error", async () => {
      mockGet.mockRejectedValueOnce(new Error("fail"));

      expect(await getHideSteamCloud()).toBe(false);
    });

    it("persists the value", async () => {
      await setHideSteamCloud(true);

      expect(mockSet).toHaveBeenCalledWith("hideSteamCloud", true);
    });

    it("does not throw on set error", async () => {
      mockSet.mockRejectedValueOnce(new Error("fail"));

      await expect(setHideSteamCloud(true)).resolves.toBeUndefined();
    });
  });

  describe("autostart preference", () => {
    it("persists the value", async () => {
      await setAutostart(true);

      expect(mockSet).toHaveBeenCalledWith("autostart", true);
    });

    it("does not throw on set error", async () => {
      mockSet.mockRejectedValueOnce(new Error("fail"));

      await expect(setAutostart(true)).resolves.toBeUndefined();
    });
  });

  describe("sync fingerprints", () => {
    it("returns persisted fingerprints", async () => {
      const fps = { game: { hash: "abc", syncedAt: "2024-01-01" } };
      mockGet.mockResolvedValueOnce(fps);

      expect(await getSyncFingerprints()).toEqual(fps);
    });

    it("returns empty object when none stored", async () => {
      mockGet.mockResolvedValueOnce(null);

      expect(await getSyncFingerprints()).toEqual({});
    });

    it("sets fingerprint for a game", async () => {
      mockGet.mockResolvedValueOnce({ existing: { hash: "x", syncedAt: "t" } });
      const fingerprint: GameSyncFingerprint = { hash: "new", syncedAt: "now" };

      await setSyncFingerprint("game", fingerprint);

      expect(mockSet).toHaveBeenCalledWith("syncFingerprints", {
        existing: { hash: "x", syncedAt: "t" },
        game: fingerprint,
      });
    });
  });
});
