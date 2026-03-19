import { describe, it, expect } from "vitest";
import { computeGameHash } from "./hash";
import type { SaveFile } from "@/domain/types";

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
    expect(computeGameHash(files)).toBe(computeGameHash(files));
  });

  it("returns different hashes for different file sizes", () => {
    const a = [makeSaveFile({ sizeBytes: 100 })];
    const b = [makeSaveFile({ sizeBytes: 200 })];
    expect(computeGameHash(a)).not.toBe(computeGameHash(b));
  });

  it("returns different hashes for different timestamps", () => {
    const a = [makeSaveFile({ lastModified: new Date("2026-01-01") })];
    const b = [makeSaveFile({ lastModified: new Date("2026-01-02") })];
    expect(computeGameHash(a)).not.toBe(computeGameHash(b));
  });

  it("is order-independent", () => {
    const fileA = makeSaveFile({ path: "/a.dat", name: "a.dat" });
    const fileB = makeSaveFile({ path: "/b.dat", name: "b.dat" });
    expect(computeGameHash([fileA, fileB])).toBe(computeGameHash([fileB, fileA]));
  });

  it("returns a non-empty string", () => {
    expect(computeGameHash([makeSaveFile()])).toBeTruthy();
  });

  it("handles empty file list", () => {
    expect(computeGameHash([])).toBeTruthy();
  });
});
