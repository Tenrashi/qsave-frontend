import { describe, it, expect, vi, beforeEach } from "vitest";
import { startWatching, stopWatching, getWatchedDirectories } from "./watcher";

const mockUnwatch = vi.fn();

vi.mock("@tauri-apps/plugin-fs", () => ({
  watchImmediate: vi.fn(() => Promise.resolve(mockUnwatch)),
}));

describe("watcher", () => {
  beforeEach(async () => {
    await stopWatching();
    vi.clearAllMocks();
  });

  it("tracks watched directories", async () => {
    await startWatching(["/saves/game1", "/saves/game2"], vi.fn());

    expect(getWatchedDirectories()).toEqual(["/saves/game1", "/saves/game2"]);
  });

  it("does not duplicate watchers for the same directory", async () => {
    const { watchImmediate } = await import("@tauri-apps/plugin-fs");

    await startWatching(["/saves/game1"], vi.fn());
    await startWatching(["/saves/game1"], vi.fn());

    expect(watchImmediate).toHaveBeenCalledTimes(1);
  });

  it("clears all watchers on stopWatching", async () => {
    await startWatching(["/saves/game1"], vi.fn());
    await stopWatching();

    expect(getWatchedDirectories()).toEqual([]);
    expect(mockUnwatch).toHaveBeenCalledOnce();
  });

  it("clears a single directory on stopWatching with argument", async () => {
    await startWatching(["/saves/game1", "/saves/game2"], vi.fn());
    await stopWatching("/saves/game1");

    expect(getWatchedDirectories()).toEqual(["/saves/game2"]);
  });
});
