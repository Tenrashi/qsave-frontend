import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  postTokenExchange,
  postTokenRefresh,
  postTokenRevoke,
  getUserInfo,
} from "./auth";

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

      const result = await postTokenExchange(
        "code",
        "http://localhost:8080/callback",
      );

      expect(result.access_token).toBe("at");
      expect(result.refresh_token).toBe("rt");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(400));

      await expect(
        postTokenExchange("code", "http://localhost:9999/callback"),
      ).rejects.toThrow("Token exchange failed: 400");
    });

    it("includes code verifier when provided", async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
        }),
      );

      await postTokenExchange(
        "code",
        "http://localhost:8080/callback",
        "verifier-123",
      );

      const body = mockFetch.mock.calls[0][1].body as string;
      expect(body).toContain("code_verifier=verifier-123");
    });

    it("wraps network errors with context", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        postTokenExchange("code", "http://localhost:9999/callback"),
      ).rejects.toThrow("Token exchange failed: Network error");
    });

    it("handles non-Error throw", async () => {
      mockFetch.mockRejectedValueOnce("string error");

      await expect(
        postTokenExchange("code", "http://localhost:9999/callback"),
      ).rejects.toThrow("Token exchange failed: string error");
    });

    it("rejects non-localhost redirect URI", async () => {
      await expect(
        postTokenExchange("code", "http://evil.com/callback"),
      ).rejects.toThrow("Invalid redirect URI");
    });

    it("rejects redirect URI without /callback path", async () => {
      await expect(
        postTokenExchange("code", "http://localhost:8080/other"),
      ).rejects.toThrow("Invalid redirect URI");
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

    it("wraps network errors with context", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(postTokenRefresh("rt")).rejects.toThrow(
        "Token refresh failed: Network error",
      );
    });

    it("handles non-Error throw", async () => {
      mockFetch.mockRejectedValueOnce("string error");

      await expect(postTokenRefresh("rt")).rejects.toThrow(
        "Token refresh failed: string error",
      );
    });
  });

  describe("postTokenRevoke", () => {
    it("sends token to revocation endpoint", async () => {
      mockFetch.mockResolvedValueOnce(okResponse({}));

      await postTokenRevoke("my-token");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("revoke"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(400));

      await expect(postTokenRevoke("my-token")).rejects.toThrow(
        "Token revocation failed",
      );
    });

    it("wraps network errors with context", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(postTokenRevoke("my-token")).rejects.toThrow(
        "Token revocation failed: Network error",
      );
    });

    it("handles non-Error throw", async () => {
      mockFetch.mockRejectedValueOnce("string error");

      await expect(postTokenRevoke("my-token")).rejects.toThrow(
        "Token revocation failed: string error",
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

    it("wraps network errors with context", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(getUserInfo("token")).rejects.toThrow(
        "Failed to fetch user info: Network error",
      );
    });

    it("handles non-Error throw", async () => {
      mockFetch.mockRejectedValueOnce("string error");

      await expect(getUserInfo("token")).rejects.toThrow(
        "Failed to fetch user info: string error",
      );
    });
  });
});
