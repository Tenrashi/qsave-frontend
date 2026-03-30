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
  mockGetAuthState,
  mockSetAuthState,
  mockClearAuth,
  mockPostTokenExchange,
  mockPostTokenRefresh,
  mockGetUserInfo,
  mockNotify,
  mockLogout,
  mockGenerateCodeVerifier,
  mockGenerateCodeChallenge,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockGetAuthState: vi.fn(),
  mockSetAuthState: vi.fn(),
  mockClearAuth: vi.fn(),
  mockPostTokenExchange: vi.fn(),
  mockPostTokenRefresh: vi.fn(),
  mockGetUserInfo: vi.fn(),
  mockNotify: vi.fn(),
  mockLogout: vi.fn(() => Promise.resolve()),
  mockGenerateCodeVerifier: vi.fn(() => "test-verifier"),
  mockGenerateCodeChallenge: vi.fn(() => Promise.resolve("test-challenge")),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@/lib/store/store", () => ({
  getAuthState: mockGetAuthState,
  setAuthState: mockSetAuthState,
  clearAuth: mockClearAuth,
}));

vi.mock("@/services/auth/auth", () => ({
  postTokenExchange: mockPostTokenExchange,
  postTokenRefresh: mockPostTokenRefresh,
  getUserInfo: mockGetUserInfo,
}));

vi.mock("@/lib/pkce/pkce", () => ({
  generateCodeVerifier: mockGenerateCodeVerifier,
  generateCodeChallenge: mockGenerateCodeChallenge,
}));

vi.mock("@/lib/notify/notify", () => ({
  notify: mockNotify,
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: {
    getState: () => ({ logout: mockLogout }),
  },
}));

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
      mockGetAuthState.mockResolvedValueOnce({
        isAuthenticated: true,
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 60_000,
      });

      // refreshAccessToken calls getAuthState again
      mockGetAuthState.mockResolvedValueOnce({
        isAuthenticated: true,
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 60_000,
      });

      mockPostTokenRefresh.mockResolvedValueOnce({
        access_token: "new-token",
        expires_in: 3600,
      });

      const token = await getValidToken();

      expect(token).toBe("new-token");
    });

    it("falls back to original token when refresh returns no accessToken", async () => {
      mockGetAuthState.mockResolvedValueOnce({
        isAuthenticated: true,
        accessToken: "original-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 60_000,
      });

      mockGetAuthState.mockResolvedValueOnce({
        isAuthenticated: true,
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 60_000,
      });

      mockPostTokenRefresh.mockResolvedValueOnce({
        access_token: undefined,
        expires_in: 3600,
      });

      const token = await getValidToken();

      expect(token).toBe("original-token");
    });
  });

  describe("logout", () => {
    it("clears auth state from store", async () => {
      await logout();

      expect(mockClearAuth).toHaveBeenCalledOnce();
    });
  });

  describe("startOAuthFlow", () => {
    it("gets redirect URI, builds auth URL with PKCE, and exchanges code", async () => {
      mockInvoke
        .mockResolvedValueOnce("http://localhost:8080/callback")
        .mockResolvedValueOnce("auth-code-123");

      mockPostTokenExchange.mockResolvedValueOnce({
        access_token: "token-abc",
        refresh_token: "refresh-abc",
        expires_in: 3600,
      });
      mockGetUserInfo.mockResolvedValueOnce({ email: "user@test.com" });

      const result = await startOAuthFlow();

      expect(result.isAuthenticated).toBe(true);
      expect(result.email).toBe("user@test.com");
      expect(result.accessToken).toBe("token-abc");
      expect(mockSetAuthState).toHaveBeenCalled();

      const authUrl = mockInvoke.mock.calls[1][1].authUrl;
      expect(authUrl).toContain("code_challenge=test-challenge");
      expect(authUrl).toContain("code_challenge_method=S256");
      expect(mockPostTokenExchange).toHaveBeenCalledWith(
        "auth-code-123",
        "http://localhost:8080/callback",
        "test-verifier",
      );
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("exchanges code and fetches user info", async () => {
      mockPostTokenExchange.mockResolvedValueOnce({
        access_token: "at",
        refresh_token: "rt",
        expires_in: 3600,
      });
      mockGetUserInfo.mockResolvedValueOnce({ email: "test@test.com" });

      const result = await exchangeCodeForTokens("code", "http://redirect");

      expect(result.isAuthenticated).toBe(true);
      expect(result.email).toBe("test@test.com");
      expect(result.accessToken).toBe("at");
      expect(result.refreshToken).toBe("rt");
      expect(mockSetAuthState).toHaveBeenCalledWith(result);
    });

    it("gets redirect URI from invoke when not provided", async () => {
      mockInvoke.mockResolvedValueOnce("http://localhost/cb");
      mockPostTokenExchange.mockResolvedValueOnce({
        access_token: "at",
        expires_in: 3600,
      });
      mockGetUserInfo.mockResolvedValueOnce({ email: "a@b.com" });

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

      mockPostTokenRefresh.mockResolvedValueOnce({
        access_token: "new-at",
        expires_in: 3600,
      });

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

      mockPostTokenRefresh.mockRejectedValueOnce(
        new Error("Token refresh failed: 401"),
      );

      await expect(refreshAccessToken()).rejects.toThrow(
        "Token refresh failed: 401",
      );
    });

    it("logs out and notifies user on refresh failure", async () => {
      mockGetAuthState.mockResolvedValueOnce({
        isAuthenticated: true,
        refreshToken: "rt",
      });

      mockPostTokenRefresh.mockRejectedValueOnce(
        new Error("Token refresh failed: 400"),
      );

      await expect(refreshAccessToken()).rejects.toThrow();

      expect(mockLogout).toHaveBeenCalledOnce();
      expect(mockNotify).toHaveBeenCalledWith(
        "QSave",
        "notifications.sessionExpired",
      );
    });
  });
});
