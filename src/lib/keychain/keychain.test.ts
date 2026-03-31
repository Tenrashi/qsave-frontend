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
    it("stores both tokens in a single keychain call", async () => {
      await setTokens("access-token", "refresh-token");

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith("keychain_set_tokens", {
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
    });

    it("passes null for undefined tokens", async () => {
      await setTokens("access-token", undefined);

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith("keychain_set_tokens", {
        accessToken: "access-token",
        refreshToken: null,
      });
    });

    it("passes null for both when both are undefined", async () => {
      await setTokens(undefined, undefined);

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith("keychain_set_tokens", {
        accessToken: null,
        refreshToken: null,
      });
    });
  });

  describe("getTokens", () => {
    it("retrieves both tokens from a single keychain call", async () => {
      mockInvoke.mockResolvedValueOnce({
        access_token: "access-token",
        refresh_token: "refresh-token",
      });

      const result = await getTokens();

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith("keychain_get_tokens");
      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
    });

    it("returns undefined for null tokens", async () => {
      mockInvoke.mockResolvedValueOnce({
        access_token: null,
        refresh_token: null,
      });

      const result = await getTokens();

      expect(result).toEqual({
        accessToken: undefined,
        refreshToken: undefined,
      });
    });

    it("returns only access token when refresh token is null", async () => {
      mockInvoke.mockResolvedValueOnce({
        access_token: "access-token",
        refresh_token: null,
      });

      const result = await getTokens();

      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: undefined,
      });
    });

    it("propagates invoke errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("keychain locked"));

      await expect(getTokens()).rejects.toThrow("keychain locked");
    });
  });

  describe("setTokens", () => {
    it("propagates invoke errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("keychain locked"));

      await expect(setTokens("at", "rt")).rejects.toThrow("keychain locked");
    });
  });

  describe("deleteTokens", () => {
    it("deletes tokens in a single keychain call", async () => {
      await deleteTokens();

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith("keychain_delete_tokens");
    });

    it("propagates invoke errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("keychain locked"));

      await expect(deleteTokens()).rejects.toThrow("keychain locked");
    });
  });
});
