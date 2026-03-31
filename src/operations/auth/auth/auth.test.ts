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
  mockAuthState,
  mockSetAuthState,
  mockClearAuth,
  mockPostTokenExchange,
  mockPostTokenRefresh,
  mockPostTokenRevoke,
  mockGetUserInfo,
  mockNotify,
  mockLogout,
  mockSetState,
  mockGenerateCodeVerifier,
  mockGenerateCodeChallenge,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockAuthState: {
    current: { isAuthenticated: false } as Record<string, unknown>,
  },
  mockSetAuthState: vi.fn(),
  mockClearAuth: vi.fn(),
  mockPostTokenExchange: vi.fn(),
  mockPostTokenRefresh: vi.fn(),
  mockPostTokenRevoke: vi.fn(() => Promise.resolve()),
  mockGetUserInfo: vi.fn(),
  mockNotify: vi.fn(),
  mockLogout: vi.fn(() => Promise.resolve()),
  mockSetState: vi.fn(),
  mockGenerateCodeVerifier: vi.fn(() => "test-verifier"),
  mockGenerateCodeChallenge: vi.fn(() => Promise.resolve("test-challenge")),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@/lib/store/store", () => ({
  setAuthState: mockSetAuthState,
  clearAuth: mockClearAuth,
}));

vi.mock("@/services/auth/auth", () => ({
  postTokenExchange: mockPostTokenExchange,
  postTokenRefresh: mockPostTokenRefresh,
  postTokenRevoke: mockPostTokenRevoke,
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
    getState: () => ({ auth: mockAuthState.current, logout: mockLogout }),
    setState: mockSetState,
  },
}));

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.current = { isAuthenticated: false };
  });

  describe("getValidToken", () => {
    it("returns access token when authenticated and not expired", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        accessToken: "valid-token",
        expiresAt: Date.now() + 3_600_000,
      };

      expect(await getValidToken()).toBe("valid-token");
    });

    it("reads from in-memory store without hitting keychain", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        accessToken: "valid-token",
        expiresAt: Date.now() + 3_600_000,
      };

      await getValidToken();

      expect(mockSetAuthState).not.toHaveBeenCalled();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("throws when not authenticated", async () => {
      mockAuthState.current = { isAuthenticated: false };

      await expect(getValidToken()).rejects.toThrow("Not authenticated");
    });

    it("throws when authenticated but accessToken is missing", async () => {
      mockAuthState.current = { isAuthenticated: true };

      await expect(getValidToken()).rejects.toThrow("Not authenticated");
    });

    it("refreshes token when expiring within buffer", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        accessToken: "old-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 60_000,
      };

      mockPostTokenRefresh.mockResolvedValueOnce({
        access_token: "new-token",
        expires_in: 3600,
      });

      const token = await getValidToken();

      expect(token).toBe("new-token");
    });

    it("falls back to original token when refresh returns no accessToken", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        accessToken: "original-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 60_000,
      };

      mockPostTokenRefresh.mockResolvedValueOnce({
        access_token: undefined,
        expires_in: 3600,
      });

      const token = await getValidToken();

      expect(token).toBe("original-token");
    });

    it("does not refresh when expiresAt is undefined", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        accessToken: "valid-token",
      };

      const token = await getValidToken();

      expect(token).toBe("valid-token");
      expect(mockPostTokenRefresh).not.toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("revokes refresh token and clears auth state", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        accessToken: "at",
        refreshToken: "rt",
      };

      await logout();

      expect(mockPostTokenRevoke).toHaveBeenCalledWith("rt");
      expect(mockClearAuth).toHaveBeenCalledOnce();
    });

    it("reads from in-memory store without hitting keychain", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        accessToken: "at",
        refreshToken: "rt",
      };

      await logout();

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("falls back to access token when no refresh token", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        accessToken: "at",
      };

      await logout();

      expect(mockPostTokenRevoke).toHaveBeenCalledWith("at");
      expect(mockClearAuth).toHaveBeenCalledOnce();
    });

    it("clears auth even if revocation fails", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        refreshToken: "rt",
      };
      mockPostTokenRevoke.mockRejectedValueOnce(new Error("network error"));

      await logout();

      expect(mockClearAuth).toHaveBeenCalledOnce();
    });

    it("skips revocation when no tokens exist", async () => {
      mockAuthState.current = { isAuthenticated: false };

      await logout();

      expect(mockPostTokenRevoke).not.toHaveBeenCalled();
      expect(mockClearAuth).toHaveBeenCalledOnce();
    });
  });

  describe("startOAuthFlow", () => {
    it("builds auth URL with PKCE and state, and exchanges code with returned redirect URI", async () => {
      mockInvoke.mockResolvedValueOnce({
        code: "auth-code-123",
        redirect_uri: "http://localhost:54321/callback",
      });

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

      const startOAuthCall = mockInvoke.mock.calls[0][1];
      const authUrlBase = startOAuthCall.authUrlBase;
      expect(authUrlBase).toContain("code_challenge=test-challenge");
      expect(authUrlBase).toContain("code_challenge_method=S256");
      expect(authUrlBase).toContain("state=");
      expect(startOAuthCall.expectedState).toBeDefined();
      expect(authUrlBase).toContain(`state=${startOAuthCall.expectedState}`);
      expect(authUrlBase).not.toContain("redirect_uri");
      expect(mockGenerateCodeVerifier).toHaveBeenCalledOnce();
      expect(mockPostTokenExchange).toHaveBeenCalledWith(
        "auth-code-123",
        "http://localhost:54321/callback",
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
  });

  describe("refreshAccessToken", () => {
    it("refreshes and persists to both keychain and in-memory store", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        accessToken: "old",
        refreshToken: "rt",
        email: "a@b.com",
        expiresAt: Date.now(),
      };

      mockPostTokenRefresh.mockResolvedValueOnce({
        access_token: "new-at",
        expires_in: 3600,
      });

      const result = await refreshAccessToken();

      expect(result.accessToken).toBe("new-at");
      expect(result.email).toBe("a@b.com");
      expect(mockSetAuthState).toHaveBeenCalledWith(result);
      expect(mockSetState).toHaveBeenCalledWith({ auth: result });
    });

    it("reads from in-memory store without hitting keychain", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        accessToken: "old",
        refreshToken: "rt",
        expiresAt: Date.now(),
      };

      mockPostTokenRefresh.mockResolvedValueOnce({
        access_token: "new-at",
        expires_in: 3600,
      });

      await refreshAccessToken();

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("preserves existing auth fields in updated state", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        accessToken: "old",
        refreshToken: "rt",
        email: "a@b.com",
        expiresAt: Date.now(),
      };

      mockPostTokenRefresh.mockResolvedValueOnce({
        access_token: "new-at",
        expires_in: 3600,
      });

      const result = await refreshAccessToken();

      expect(result.isAuthenticated).toBe(true);
      expect(result.refreshToken).toBe("rt");
      expect(result.email).toBe("a@b.com");
    });

    it("throws when no refresh token", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        accessToken: "at",
      };

      await expect(refreshAccessToken()).rejects.toThrow("No refresh token");
    });

    it("throws on refresh failure", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        refreshToken: "rt",
      };

      mockPostTokenRefresh.mockRejectedValueOnce(
        new Error("Token refresh failed: 401"),
      );

      await expect(refreshAccessToken()).rejects.toThrow(
        "Token refresh failed: 401",
      );
    });

    it("logs out and notifies user on refresh failure", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        refreshToken: "rt",
      };

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

    it("does not update stores on refresh failure", async () => {
      mockAuthState.current = {
        isAuthenticated: true,
        refreshToken: "rt",
      };

      mockPostTokenRefresh.mockRejectedValueOnce(new Error("fail"));

      await expect(refreshAccessToken()).rejects.toThrow();

      expect(mockSetAuthState).not.toHaveBeenCalled();
      expect(mockSetState).not.toHaveBeenCalled();
    });
  });
});
