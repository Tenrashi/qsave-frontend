import { describe, it, expect, vi, beforeEach } from "vitest";
import { setTokens, getTokens, deleteTokens } from "./keychain";

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn((): Promise<unknown> => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

describe("keychain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setTokens", () => {
    it("stores both tokens via keychain commands", async () => {
      await setTokens("access-token", "refresh-token");

      expect(mockInvoke).toHaveBeenCalledWith("keychain_set", {
        key: "access_token",
        value: "access-token",
      });
      expect(mockInvoke).toHaveBeenCalledWith("keychain_set", {
        key: "refresh_token",
        value: "refresh-token",
      });
    });

    it("stores only access token when refresh token is undefined", async () => {
      await setTokens("access-token", undefined);

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith("keychain_set", {
        key: "access_token",
        value: "access-token",
      });
    });

    it("does nothing when both tokens are undefined", async () => {
      await setTokens(undefined, undefined);

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe("getTokens", () => {
    it("retrieves both tokens from keychain", async () => {
      mockInvoke
        .mockResolvedValueOnce("access-token")
        .mockResolvedValueOnce("refresh-token");

      const result = await getTokens();

      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
    });

    it("returns undefined for missing tokens", async () => {
      mockInvoke.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const result = await getTokens();

      expect(result).toEqual({
        accessToken: undefined,
        refreshToken: undefined,
      });
    });
  });

  describe("deleteTokens", () => {
    it("deletes both tokens from keychain", async () => {
      await deleteTokens();

      expect(mockInvoke).toHaveBeenCalledWith("keychain_delete", {
        key: "access_token",
      });
      expect(mockInvoke).toHaveBeenCalledWith("keychain_delete", {
        key: "refresh_token",
      });
    });
  });
});
