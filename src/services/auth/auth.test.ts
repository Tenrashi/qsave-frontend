import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getValidToken,
  logout,
  startOAuthFlow,
  exchangeCodeForTokens,
  refreshAccessToken,
} from "./auth";

const {
  mockInvoke,
  mockFetch,
  mockGetAuthState,
  mockSetAuthState,
  mockClearAuth,
  mockNotify,
  mockLogout,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockFetch: vi.fn(),
  mockGetAuthState: vi.fn(),
  mockSetAuthState: vi.fn(),
  mockClearAuth: vi.fn(),
  mockNotify: vi.fn(),
  mockLogout: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: mockFetch,
}));

vi.mock("@/lib/store/store", () => ({
  getAuthState: mockGetAuthState,
  setAuthState: mockSetAuthState,
  clearAuth: mockClearAuth,
}));

vi.mock("@/lib/notify/notify", () => ({
  notify: mockNotify,
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: {
    getState: () => ({ logout: mockLogout }),
  },
}));

const mockJsonResponse = (data: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
});

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getValidToken", () => {
    it("returns access token when authenticated and not expired", async () => {
      mockGetAuthState.mockResolvedValueOnce({
        isAuthenticated: true,
        accessToken: "valid-token",
        expiresAt: Date.now() + 3_600_000,
      });

      expect(await getValidToken()).toBe("valid-token");
    });

    it("throws when not authenticated", async () => {
      mockGetAuthState.mockResolvedValueOnce({ isAuthenticated: false });

      await expect(getValidToken()).rejects.toThrow("Not authenticated");
    });

    it("refreshes token when expiring within buffer", async () => {
      mockGetAuthState
        .mockResolvedValueOnce({
          isAuthenticated: true,
          accessToken: "old-token",
          refreshToken: "refresh-token",
          expiresAt: Date.now() + 60_000,
        })
        .mockResolvedValueOnce({
          isAuthenticated: true,
          accessToken: "old-token",
          refreshToken: "refresh-token",
          expiresAt: Date.now() + 60_000,
        });

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          access_token: "new-token",
          expires_in: 3600,
        }),
      );

      const token = await getValidToken();

      expect(token).toBe("new-token");
    });
  });

  describe("logout", () => {
    it("clears auth state from store", async () => {
      await logout();

      expect(mockClearAuth).toHaveBeenCalledOnce();
    });
  });

  describe("startOAuthFlow", () => {
    it("gets redirect URI, builds auth URL, and exchanges code", async () => {
      mockInvoke
        .mockResolvedValueOnce("http://localhost:8080/callback")
        .mockResolvedValueOnce("auth-code-123");

      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            access_token: "token-abc",
            refresh_token: "refresh-abc",
            expires_in: 3600,
          }),
        )
        .mockResolvedValueOnce(mockJsonResponse({ email: "user@test.com" }));

      const result = await startOAuthFlow();

      expect(result.isAuthenticated).toBe(true);
      expect(result.email).toBe("user@test.com");
      expect(result.accessToken).toBe("token-abc");
      expect(mockSetAuthState).toHaveBeenCalled();
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("exchanges code and fetches user info", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            access_token: "at",
            refresh_token: "rt",
            expires_in: 3600,
          }),
        )
        .mockResolvedValueOnce(mockJsonResponse({ email: "test@test.com" }));

      const result = await exchangeCodeForTokens("code", "http://redirect");

      expect(result.isAuthenticated).toBe(true);
      expect(result.email).toBe("test@test.com");
      expect(result.accessToken).toBe("at");
      expect(result.refreshToken).toBe("rt");
      expect(mockSetAuthState).toHaveBeenCalledWith(result);
    });

    it("throws on token exchange failure", async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({}, false, 400));

      await expect(
        exchangeCodeForTokens("code", "http://redirect"),
      ).rejects.toThrow("Token exchange failed: 400");
    });

    it("throws on user info failure", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({ access_token: "at", expires_in: 3600 }),
        )
        .mockResolvedValueOnce(mockJsonResponse({}, false, 401));

      await expect(
        exchangeCodeForTokens("code", "http://redirect"),
      ).rejects.toThrow("Failed to fetch user info: 401");
    });

    it("gets redirect URI from invoke when not provided", async () => {
      mockInvoke.mockResolvedValueOnce("http://localhost/cb");
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({ access_token: "at", expires_in: 3600 }),
        )
        .mockResolvedValueOnce(mockJsonResponse({ email: "a@b.com" }));

      await exchangeCodeForTokens("code");

      expect(mockInvoke).toHaveBeenCalledWith("get_oauth_redirect_uri");
    });
  });

  describe("refreshAccessToken", () => {
    it("refreshes and persists new token", async () => {
      mockGetAuthState.mockResolvedValueOnce({
        isAuthenticated: true,
        accessToken: "old",
        refreshToken: "rt",
        email: "a@b.com",
        expiresAt: Date.now(),
      });

      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ access_token: "new-at", expires_in: 3600 }),
      );

      const result = await refreshAccessToken();

      expect(result.accessToken).toBe("new-at");
      expect(result.email).toBe("a@b.com");
      expect(mockSetAuthState).toHaveBeenCalledWith(result);
    });

    it("throws when no refresh token", async () => {
      mockGetAuthState.mockResolvedValueOnce({
        isAuthenticated: true,
        accessToken: "at",
      });

      await expect(refreshAccessToken()).rejects.toThrow("No refresh token");
    });

    it("throws on refresh failure", async () => {
      mockGetAuthState.mockResolvedValueOnce({
        isAuthenticated: true,
        refreshToken: "rt",
      });

      mockFetch.mockResolvedValueOnce(mockJsonResponse({}, false, 401));

      await expect(refreshAccessToken()).rejects.toThrow(
        "Token refresh failed: 401",
      );
    });

    it("logs out and notifies user on refresh failure", async () => {
      mockGetAuthState.mockResolvedValueOnce({
        isAuthenticated: true,
        refreshToken: "rt",
      });

      mockFetch.mockResolvedValueOnce(mockJsonResponse({}, false, 400));

      await expect(refreshAccessToken()).rejects.toThrow();

      expect(mockLogout).toHaveBeenCalledOnce();
      expect(mockNotify).toHaveBeenCalledWith(
        "QSave",
        "notifications.sessionExpired",
      );
    });
  });
});
