import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  scanForGames,
  scanManualGame,
  rescanGame,
  loadCachedGames,
} from "./scanner";

import type { ManualGameEntry } from "@/lib/store/store";

const { mockInvoke, mockGetManualGames } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockGetManualGames: vi.fn(
    (): Promise<ManualGameEntry[]> => Promise.resolve([]),
  ),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@/lib/store/store", () => ({
  getManualGames: mockGetManualGames,
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
  platform: null,
  hasSteamCloud: false,
});

describe("scanManualGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a game marked as manual", async () => {
    mockInvoke.mockResolvedValueOnce(rustGame("Custom Game"));

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
    mockInvoke.mockResolvedValueOnce(rustGame("Custom Game"));

    const game = await rescanGame({
      name: "Custom Game",
      savePaths: ["/saves/custom"],
      saveFiles: [],
      isManual: true,
    });

    expect(game.isManual).toBe(true);
  });
});

describe("loadCachedGames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached auto games with manual games combined", async () => {
    mockInvoke.mockResolvedValueOnce([rustGame("Elden Ring")]);
    mockGetManualGames.mockResolvedValueOnce([
      { name: "My Custom Game", paths: ["/saves/custom"] },
    ]);

    const games = await loadCachedGames();

    expect(games.map((game) => game.name)).toEqual([
      "Elden Ring",
      "My Custom Game",
    ]);
    expect(games[0].isManual).toBeFalsy();
    expect(games[1].isManual).toBe(true);
    expect(games[1].saveFiles).toEqual([]);
  });

  it("returns empty when cache is empty", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    mockGetManualGames.mockResolvedValueOnce([
      { name: "Custom", paths: ["/saves/custom"] },
    ]);

    const games = await loadCachedGames();

    expect(games).toEqual([]);
  });

  it("skips manual games that overlap with cached auto games", async () => {
    mockInvoke.mockResolvedValueOnce([rustGame("Elden Ring")]);
    mockGetManualGames.mockResolvedValueOnce([
      { name: "Elden Ring", paths: ["/saves/elden"] },
    ]);

    const games = await loadCachedGames();

    expect(games).toHaveLength(1);
    expect(games[0].isManual).toBeFalsy();
  });
});

describe("scanForGames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auto-detected games sorted by name", async () => {
    mockInvoke.mockResolvedValueOnce([
      rustGame("Zelda"),
      rustGame("Elden Ring"),
    ]);

    const games = await scanForGames();

    expect(games.map((game) => game.name)).toEqual(["Elden Ring", "Zelda"]);
    expect(games[0].isManual).toBeFalsy();
  });

  it("includes manual games that are not auto-detected", async () => {
    mockInvoke
      .mockResolvedValueOnce([rustGame("Elden Ring")])
      .mockResolvedValueOnce(rustGame("My Custom Game"));

    mockGetManualGames.mockResolvedValueOnce([
      { name: "My Custom Game", paths: ["/saves/custom"] },
    ]);

    const games = await scanForGames();

    expect(games.map((game) => game.name)).toEqual([
      "Elden Ring",
      "My Custom Game",
    ]);
    expect(games[1].isManual).toBe(true);
  });

  it("skips manual games that overlap with auto-detected", async () => {
    mockInvoke.mockResolvedValueOnce([rustGame("Elden Ring")]);

    mockGetManualGames.mockResolvedValueOnce([
      { name: "Elden Ring", paths: ["/saves/elden"] },
    ]);

    const games = await scanForGames();

    expect(games).toHaveLength(1);
    expect(games[0].isManual).toBeFalsy();
  });
});
