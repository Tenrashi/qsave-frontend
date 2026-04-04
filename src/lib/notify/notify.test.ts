import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { notify } from "./notify";

const isFocused = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({ isFocused })),
}));

describe("notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isFocused.mockResolvedValue(false);
  });

  it("invokes the native notification command when window is not focused", async () => {
    await notify("QSave", "Sync complete");

    expect(invoke).toHaveBeenCalledWith("send_native_notification", {
      title: "QSave",
      body: "Sync complete",
    });
  });

  it("skips notification when window is focused", async () => {
    isFocused.mockResolvedValue(true);

    await notify("QSave", "Sync complete");

    expect(invoke).not.toHaveBeenCalled();
  });

  it("does not throw when invoke fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Not supported"));

    await expect(notify("QSave", "test")).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith("[notify] Failed:", expect.any(Error));
    warnSpy.mockRestore();
  });

  it("does not throw when isFocused fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    isFocused.mockRejectedValueOnce(new Error("Window error"));

    await expect(notify("QSave", "test")).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith("[notify] Failed:", expect.any(Error));
    warnSpy.mockRestore();
  });
});
