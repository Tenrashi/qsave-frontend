import { describe, it, expect, vi, beforeEach } from "vitest";
import { scheduleAutoSync, cancelAutoSync, cancelAllAutoSyncs, hasPendingSync } from "./autoSync";

beforeEach(() => {
  vi.useFakeTimers();
  cancelAllAutoSyncs();
});

describe("scheduleAutoSync", () => {
  it("calls onSync after 30 seconds", () => {
    const onSync = vi.fn();
    scheduleAutoSync("GameA", onSync);

    vi.advanceTimersByTime(29_999);
    expect(onSync).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onSync).toHaveBeenCalledOnce();
  });

  it("resets the timer when called again for the same game", () => {
    const onSync = vi.fn();
    scheduleAutoSync("GameA", onSync);

    vi.advanceTimersByTime(20_000);
    scheduleAutoSync("GameA", onSync);

    vi.advanceTimersByTime(20_000);
    expect(onSync).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(onSync).toHaveBeenCalledOnce();
  });

  it("tracks separate timers per game", () => {
    const onSyncA = vi.fn();
    const onSyncB = vi.fn();
    scheduleAutoSync("GameA", onSyncA);
    scheduleAutoSync("GameB", onSyncB);

    vi.advanceTimersByTime(30_000);
    expect(onSyncA).toHaveBeenCalledOnce();
    expect(onSyncB).toHaveBeenCalledOnce();
  });
});

describe("cancelAutoSync", () => {
  it("prevents the callback from firing", () => {
    const onSync = vi.fn();
    scheduleAutoSync("GameA", onSync);
    cancelAutoSync("GameA");

    vi.advanceTimersByTime(30_000);
    expect(onSync).not.toHaveBeenCalled();
  });

  it("does nothing for unknown game", () => {
    expect(() => cancelAutoSync("Unknown")).not.toThrow();
  });
});

describe("cancelAllAutoSyncs", () => {
  it("cancels all pending timers", () => {
    const onSyncA = vi.fn();
    const onSyncB = vi.fn();
    scheduleAutoSync("GameA", onSyncA);
    scheduleAutoSync("GameB", onSyncB);

    cancelAllAutoSyncs();
    vi.advanceTimersByTime(30_000);

    expect(onSyncA).not.toHaveBeenCalled();
    expect(onSyncB).not.toHaveBeenCalled();
  });
});

describe("hasPendingSync", () => {
  it("returns true when a timer is pending", () => {
    scheduleAutoSync("GameA", vi.fn());
    expect(hasPendingSync("GameA")).toBe(true);
  });

  it("returns false after timer fires", () => {
    scheduleAutoSync("GameA", vi.fn());
    vi.advanceTimersByTime(30_000);
    expect(hasPendingSync("GameA")).toBe(false);
  });

  it("returns false after cancellation", () => {
    scheduleAutoSync("GameA", vi.fn());
    cancelAutoSync("GameA");
    expect(hasPendingSync("GameA")).toBe(false);
  });
});
