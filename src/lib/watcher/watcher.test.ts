import { describe, it, expect, vi, beforeEach } from "vitest";
import { startWatching, stopWatching, getWatchedDirectories } from "./watcher";

type WatchEvent = { paths: unknown };
type WatchHandler = (event: WatchEvent) => void;

const { mockUnwatch, mockWatchImmediate } = vi.hoisted(() => {
  const mockUnwatch = vi.fn();
  return {
    mockUnwatch,
    mockWatchImmediate: vi.fn<
      (
        path: string,
        handler: WatchHandler,
        opts?: object,
      ) => Promise<() => void>
    >(() => Promise.resolve(mockUnwatch)),
  };
});

vi.mock("@tauri-apps/plugin-fs", () => ({
  watchImmediate: mockWatchImmediate,
}));

describe("watcher", () => {
  beforeEach(async () => {
    await stopWatching();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("tracks watched directories", async () => {
    await startWatching(["/saves/game1", "/saves/game2"], vi.fn());

    expect(getWatchedDirectories()).toEqual(["/saves/game1", "/saves/game2"]);
  });

  it("does not duplicate watchers for the same directory", async () => {
    await startWatching(["/saves/game1"], vi.fn());
    await startWatching(["/saves/game1"], vi.fn());

    expect(mockWatchImmediate).toHaveBeenCalledTimes(1);
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

  it("debounces file change events", async () => {
    const onChange = vi.fn();
    await startWatching(["/saves/game1"], onChange);

    const callback = mockWatchImmediate.mock.calls[0][1];

    callback({ paths: ["/saves/game1/save.dat"] });
    callback({ paths: ["/saves/game1/save.dat.tmp"] });

    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(["/saves/game1/save.dat.tmp"]);
  });

  it("filters out non-string paths", async () => {
    const onChange = vi.fn();
    await startWatching(["/saves/game1"], onChange);

    const callback = mockWatchImmediate.mock.calls[0][1];
    callback({ paths: [null, undefined, 123] });

    vi.advanceTimersByTime(2000);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("handles event.paths as single value", async () => {
    const onChange = vi.fn();
    await startWatching(["/saves/game1"], onChange);

    const callback = mockWatchImmediate.mock.calls[0][1];
    callback({ paths: "/saves/game1/save.dat" });

    vi.advanceTimersByTime(2000);

    expect(onChange).toHaveBeenCalledWith(["/saves/game1/save.dat"]);
  });

  it("skips silently when watchImmediate fails", async () => {
    mockWatchImmediate.mockRejectedValueOnce(new Error("permission denied"));

    await startWatching(["/saves/game1"], vi.fn());

    expect(getWatchedDirectories()).toEqual([]);
  });

  it("clears debounce timer when stopWatching a specific directory", async () => {
    const onChange = vi.fn();
    await startWatching(["/saves/game1"], onChange);

    const callback = mockWatchImmediate.mock.calls[0][1];
    callback({ paths: ["/saves/game1/save.dat"] });

    await stopWatching("/saves/game1");
    vi.advanceTimersByTime(2000);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears all debounce timers on global stopWatching", async () => {
    const onChange = vi.fn();
    await startWatching(["/saves/game1", "/saves/game2"], onChange);

    const callback1 = mockWatchImmediate.mock.calls[0][1];
    const callback2 = mockWatchImmediate.mock.calls[1][1];
    callback1({ paths: ["/saves/game1/save.dat"] });
    callback2({ paths: ["/saves/game2/save.dat"] });

    await stopWatching();
    vi.advanceTimersByTime(2000);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("handles stopWatching for unwatched directory", async () => {
    await stopWatching("/saves/nonexistent");

    expect(getWatchedDirectories()).toEqual([]);
  });
});
