import { describe, it, expect, vi } from "vitest";
import { computeContentHash } from "./hash";

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(() => Promise.resolve("abc123hash")),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

describe("computeContentHash", () => {
  it("invokes the compute_save_hash Tauri command", async () => {
    const result = await computeContentHash(["/saves"], ["/saves/a.dat"]);

    expect(mockInvoke).toHaveBeenCalledWith("compute_save_hash", {
      savePaths: ["/saves"],
      files: ["/saves/a.dat"],
    });
    expect(result).toBe("abc123hash");
  });
});
