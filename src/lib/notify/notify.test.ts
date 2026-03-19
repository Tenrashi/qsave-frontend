import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { notify } from "./notify";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes the native notification command", async () => {
    await notify("QSave", "Sync complete");

    expect(invoke).toHaveBeenCalledWith("send_native_notification", {
      title: "QSave",
      body: "Sync complete",
    });
  });

  it("does not throw when invoke fails", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Not supported"));

    await expect(notify("QSave", "test")).resolves.toBeUndefined();
  });
});
