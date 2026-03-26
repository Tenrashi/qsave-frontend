import { describe, it, expect, vi, beforeEach } from "vitest";
import { postTokenExchange, postTokenRefresh, getUserInfo } from "./auth";

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: mockFetch,
}));

const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(data),
});

const errorResponse = (status = 500) => ({
  ok: false,
  status,
  json: () => Promise.resolve({}),
});

describe("auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("postTokenExchange", () => {
    it("exchanges code for tokens", async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
        }),
      );

      const result = await postTokenExchange("code", "http://redirect");

      expect(result.access_token).toBe("at");
      expect(result.refresh_token).toBe("rt");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(400));

      await expect(postTokenExchange("code", "http://r")).rejects.toThrow(
        "Token exchange failed: 400",
      );
    });
  });

  describe("postTokenRefresh", () => {
    it("refreshes the token", async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({ access_token: "new-at", expires_in: 3600 }),
      );

      const result = await postTokenRefresh("rt");

      expect(result.access_token).toBe("new-at");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401));

      await expect(postTokenRefresh("rt")).rejects.toThrow(
        "Token refresh failed: 401",
      );
    });
  });

  describe("getUserInfo", () => {
    it("returns user email", async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ email: "a@b.com" }));

      const result = await getUserInfo("token");

      expect(result.email).toBe("a@b.com");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: "Bearer token" },
        }),
      );
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401));

      await expect(getUserInfo("token")).rejects.toThrow(
        "Failed to fetch user info: 401",
      );
    });
  });
});
