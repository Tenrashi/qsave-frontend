import { describe, it, expect } from "vitest";
import { computeGameHash } from "./hash";
import type { SaveFile } from "@/domain/types";

const SAVE_PATHS = ["/games"];

const makeSaveFile = (overrides: Partial<SaveFile> = {}): SaveFile => ({
  name: "save.dat",
  path: "/games/save.dat",
  sizeBytes: 1024,
  lastModified: new Date("2026-01-01T00:00:00Z"),
  gameName: "TestGame",
  ...overrides,
});

describe("computeGameHash", () => {
  it("returns a consistent hash for the same input", () => {
    const files = [makeSaveFile()];
    expect(computeGameHash(files, SAVE_PATHS)).toBe(
      computeGameHash(files, SAVE_PATHS),
    );
  });

  it("returns different hashes for different file sizes", () => {
    const fileA = [makeSaveFile({ sizeBytes: 100 })];
    const fileB = [makeSaveFile({ sizeBytes: 200 })];
    expect(computeGameHash(fileA, SAVE_PATHS)).not.toBe(
      computeGameHash(fileB, SAVE_PATHS),
    );
  });

  it("returns different hashes for different timestamps", () => {
    const fileA = [makeSaveFile({ lastModified: new Date("2026-01-01") })];
    const fileB = [makeSaveFile({ lastModified: new Date("2026-01-02") })];
    expect(computeGameHash(fileA, SAVE_PATHS)).not.toBe(
      computeGameHash(fileB, SAVE_PATHS),
    );
  });

  it("is order-independent", () => {
    const fileA = makeSaveFile({ path: "/games/a.dat", name: "a.dat" });
    const fileB = makeSaveFile({ path: "/games/b.dat", name: "b.dat" });
    expect(computeGameHash([fileA, fileB], SAVE_PATHS)).toBe(
      computeGameHash([fileB, fileA], SAVE_PATHS),
    );
  });

  it("returns a non-empty string", () => {
    expect(computeGameHash([makeSaveFile()], SAVE_PATHS)).toBeTruthy();
  });

  it("handles empty file list", () => {
    expect(computeGameHash([], SAVE_PATHS)).toBeTruthy();
  });

  it("produces the same hash for identical files under different base paths", () => {
    const aliceFile = makeSaveFile({
      path: "C:\\Users\\alice\\AppData\\Game\\save.dat",
    });
    const bobFile = makeSaveFile({
      path: "C:\\Users\\bob\\AppData\\Game\\save.dat",
    });

    const aliceHash = computeGameHash(
      [aliceFile],
      ["C:\\Users\\alice\\AppData\\Game"],
    );
    const bobHash = computeGameHash(
      [bobFile],
      ["C:\\Users\\bob\\AppData\\Game"],
    );

    expect(aliceHash).toBe(bobHash);
  });
});
