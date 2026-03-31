import { describe, expect, it } from "vitest";
import { normalizePath, pathStartsWith, pathIncluded } from "./path";

describe("normalizePath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizePath("C:\\Users\\test\\saves")).toBe("C:/Users/test/saves");
  });

  it("strips trailing slashes", () => {
    expect(normalizePath("/home/user/saves/")).toBe("/home/user/saves");
  });

  it("leaves forward-slash paths unchanged", () => {
    expect(normalizePath("/home/user/saves")).toBe("/home/user/saves");
  });
});

describe("pathStartsWith", () => {
  it("matches a child path", () => {
    expect(pathStartsWith("/Games/Saves/file.txt", "/Games/Saves")).toBe(true);
  });

  it("matches exact path", () => {
    expect(pathStartsWith("/Games/Saves", "/Games/Saves")).toBe(true);
  });

  it("rejects false prefix match without boundary", () => {
    expect(pathStartsWith("/Games/SavesBackup/file.txt", "/Games/Saves")).toBe(
      false,
    );
  });

  it("handles mixed separators on Windows-style paths", () => {
    expect(
      pathStartsWith("C:\\Games\\Saves\\file.txt", "C:\\Games\\Saves"),
    ).toBe(true);
  });

  it("handles mixed forward and backslash", () => {
    expect(pathStartsWith("C:\\Games/Saves\\file.txt", "C:/Games/Saves")).toBe(
      true,
    );
  });
});

describe("pathIncluded", () => {
  it("finds a path with matching separators", () => {
    expect(pathIncluded(["/home/user/saves"], "/home/user/saves")).toBe(true);
  });

  it("finds a path with different separators", () => {
    expect(
      pathIncluded(["C:\\Users\\test\\saves"], "C:/Users/test/saves"),
    ).toBe(true);
  });

  it("ignores trailing slashes", () => {
    expect(pathIncluded(["/home/user/saves/"], "/home/user/saves")).toBe(true);
  });

  it("returns false for missing path", () => {
    expect(pathIncluded(["/home/user/saves"], "/home/user/other")).toBe(false);
  });
});
