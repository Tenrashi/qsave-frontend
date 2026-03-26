import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSyncStore } from "./sync";

const {
  mockGetWatchedGames,
  mockSetWatchedGames,
  mockGetSyncFingerprints,
  mockSetSyncFingerprint,
  mockListBackedUpGameNames,
} = vi.hoisted(() => ({
  mockGetWatchedGames: vi.fn((): Promise<string[]> => Promise.resolve([])),
  mockSetWatchedGames: vi.fn(),
  mockGetSyncFingerprints: vi.fn(() => Promise.resolve({})),
  mockSetSyncFingerprint: vi.fn(),
  mockListBackedUpGameNames: vi.fn(
    (): Promise<string[]> => Promise.resolve([]),
  ),
}));

vi.mock("@/lib/store/store", () => ({
  getWatchedGames: mockGetWatchedGames,
  setWatchedGames: mockSetWatchedGames,
  getSyncFingerprints: mockGetSyncFingerprints,
  setSyncFingerprint: mockSetSyncFingerprint,
}));

vi.mock("@/operations/drive/backups/backups", () => ({
  listBackedUpGameNames: mockListBackedUpGameNames,
}));

describe("useSyncStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSyncStore.setState({
      gameStatuses: {},
      watchedGames: {},
      syncFingerprints: {},
      backedUpGames: new Set<string>(),
      backedUpGamesLoaded: false,
    });
  });

  describe("setGameStatus", () => {
    it("updates status for a game", () => {
      useSyncStore.getState().setGameStatus("Sims 4", "syncing");

      expect(useSyncStore.getState().gameStatuses["Sims 4"]).toBe("syncing");
    });

    it("preserves other game statuses", () => {
      useSyncStore.setState({ gameStatuses: { "Elden Ring": "success" } });

      useSyncStore.getState().setGameStatus("Sims 4", "error");

      expect(useSyncStore.getState().gameStatuses["Elden Ring"]).toBe(
        "success",
      );
      expect(useSyncStore.getState().gameStatuses["Sims 4"]).toBe("error");
    });
  });

  describe("watch preferences", () => {
    it("loads watched games as boolean map", async () => {
      mockGetWatchedGames.mockResolvedValueOnce(["Sims 4", "Elden Ring"]);

      await useSyncStore.getState().initWatchPreferences();

      expect(useSyncStore.getState().watchedGames).toEqual({
        "Sims 4": true,
        "Elden Ring": true,
      });
    });

    it("toggles game watch on", async () => {
      await useSyncStore.getState().toggleGameWatch("Sims 4");

      expect(useSyncStore.getState().watchedGames["Sims 4"]).toBe(true);
      expect(mockSetWatchedGames).toHaveBeenCalledWith(["Sims 4"]);
    });

    it("toggles game watch off", async () => {
      useSyncStore.setState({ watchedGames: { "Sims 4": true } });

      await useSyncStore.getState().toggleGameWatch("Sims 4");

      expect(useSyncStore.getState().watchedGames["Sims 4"]).toBe(false);
      expect(mockSetWatchedGames).toHaveBeenCalledWith([]);
    });

    it("isGameWatched returns correct state", () => {
      useSyncStore.setState({ watchedGames: { "Sims 4": true } });

      expect(useSyncStore.getState().isGameWatched("Sims 4")).toBe(true);
      expect(useSyncStore.getState().isGameWatched("Unknown")).toBe(false);
    });

    it("sets all games watched", async () => {
      await useSyncStore
        .getState()
        .setAllGamesWatched(["Sims 4", "Elden Ring"], true);

      expect(useSyncStore.getState().watchedGames).toEqual({
        "Sims 4": true,
        "Elden Ring": true,
      });
      expect(mockSetWatchedGames).toHaveBeenCalledWith([
        "Sims 4",
        "Elden Ring",
      ]);
    });

    it("sets all games unwatched", async () => {
      useSyncStore.setState({
        watchedGames: { "Sims 4": true, "Elden Ring": true },
      });

      await useSyncStore
        .getState()
        .setAllGamesWatched(["Sims 4", "Elden Ring"], false);

      expect(useSyncStore.getState().watchedGames).toEqual({
        "Sims 4": false,
        "Elden Ring": false,
      });
      expect(mockSetWatchedGames).toHaveBeenCalledWith([]);
    });

    it("preserves watch state of games not in the batch", async () => {
      useSyncStore.setState({
        watchedGames: { "Sims 4": true },
      });

      await useSyncStore.getState().setAllGamesWatched(["Elden Ring"], false);

      expect(useSyncStore.getState().watchedGames).toEqual({
        "Sims 4": true,
        "Elden Ring": false,
      });
      expect(mockSetWatchedGames).toHaveBeenCalledWith(["Sims 4"]);
    });
  });

  describe("sync fingerprints", () => {
    it("loads fingerprints from store", async () => {
      const fingerprints = {
        "Sims 4": { hash: "abc", syncedAt: "2024-01-01" },
      };
      mockGetSyncFingerprints.mockResolvedValueOnce(fingerprints);

      await useSyncStore.getState().initSyncFingerprints();

      expect(useSyncStore.getState().syncFingerprints).toEqual(fingerprints);
    });

    it("updates fingerprint with current timestamp", async () => {
      await useSyncStore.getState().updateSyncFingerprint("Sims 4", "newhash");

      const fingerprint = useSyncStore.getState().syncFingerprints["Sims 4"];
      expect(fingerprint.hash).toBe("newhash");
      expect(fingerprint.syncedAt).toBeDefined();
      expect(mockSetSyncFingerprint).toHaveBeenCalledWith(
        "Sims 4",
        fingerprint,
      );
    });
  });

  describe("backed up games", () => {
    it("loads backed up game names", async () => {
      mockListBackedUpGameNames.mockResolvedValueOnce(["Sims 4", "Elden Ring"]);

      await useSyncStore.getState().loadBackedUpGames();

      expect(useSyncStore.getState().backedUpGames).toEqual(
        new Set(["Sims 4", "Elden Ring"]),
      );
      expect(useSyncStore.getState().backedUpGamesLoaded).toBe(true);
    });

    it("only loads once", async () => {
      mockListBackedUpGameNames.mockResolvedValueOnce(["Sims 4"]);
      await useSyncStore.getState().loadBackedUpGames();

      await useSyncStore.getState().loadBackedUpGames();

      expect(mockListBackedUpGameNames).toHaveBeenCalledTimes(1);
    });

    it("marks a game as backed up", () => {
      useSyncStore.getState().markGameBackedUp("Sims 4");

      expect(useSyncStore.getState().hasBackup("Sims 4")).toBe(true);
      expect(useSyncStore.getState().hasBackup("Unknown")).toBe(false);
    });
  });
});
