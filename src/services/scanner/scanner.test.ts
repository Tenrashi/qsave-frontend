import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { scanForGames, scanManualGame, rescanGame } from "./scanner";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/lib/store/store", () => ({
  getManualGames: vi.fn(() => Promise.resolve([])),
}));

const rustGame = (name: string, steamId: number | null = null) => ({
  name,
  steamId,
  savePaths: [`/saves/${name.toLowerCase()}`],
  saveFiles: [
    {
      name: "save.dat",
      path: `/saves/${name.toLowerCase()}/save.dat`,
      sizeBytes: 1024,
      lastModified: 1710417600000,
      gameName: name,
    },
  ],
});

describe("scanManualGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a game marked as manual", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(rustGame("Custom Game"));

    const game = await scanManualGame("Custom Game", ["/saves/custom"]);

    expect(game.name).toBe("Custom Game");
    expect(game.isManual).toBe(true);
    expect(game.saveFiles[0].lastModified).toBeInstanceOf(Date);
  });
});

describe("rescanGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves the isManual flag from the original game", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(rustGame("Custom Game"));

    const game = await rescanGame({
      name: "Custom Game",
      savePaths: ["/saves/custom"],
      saveFiles: [],
      isManual: true,
    });

    expect(game.isManual).toBe(true);
  });
});

describe("scanForGames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auto-detected games sorted by name", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([rustGame("Zelda"), rustGame("Elden Ring")]);

    const games = await scanForGames();

    expect(games.map((game) => game.name)).toEqual(["Elden Ring", "Zelda"]);
    expect(games[0].isManual).toBeFalsy();
  });

  it("includes manual games that are not auto-detected", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce([rustGame("Elden Ring")])
      .mockResolvedValueOnce(rustGame("My Custom Game"));

    const { getManualGames } = await import("@/lib/store/store");
    vi.mocked(getManualGames).mockResolvedValueOnce([
      { name: "My Custom Game", paths: ["/saves/custom"] },
    ]);

    const games = await scanForGames();

    expect(games.map((game) => game.name)).toEqual(["Elden Ring", "My Custom Game"]);
    expect(games[1].isManual).toBe(true);
  });

  it("skips manual games that overlap with auto-detected", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([rustGame("Elden Ring")]);

    const { getManualGames } = await import("@/lib/store/store");
    vi.mocked(getManualGames).mockResolvedValueOnce([
      { name: "Elden Ring", paths: ["/saves/elden"] },
    ]);

    const games = await scanForGames();

    expect(games).toHaveLength(1);
    expect(games[0].isManual).toBeFalsy();
  });
});
