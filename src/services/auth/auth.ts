import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import type { AuthState } from "@/domain/types";
import { getAuthState, setAuthState, clearAuth } from "@/lib/store/store";
import { TAURI_COMMANDS, OAUTH_ENDPOINTS, OAUTH_PARAMS, TOKEN_EXPIRY_BUFFER_MS } from "@/lib/constants/constants";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const SCOPES = "https://www.googleapis.com/auth/drive.file email";

export const startOAuthFlow = async (): Promise<AuthState> => {
  const redirectUri: string = await invoke(TAURI_COMMANDS.getOAuthRedirectUri);

  const authUrl = new URL(OAUTH_ENDPOINTS.auth);
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", OAUTH_PARAMS.accessTypeOffline);
  authUrl.searchParams.set("prompt", OAUTH_PARAMS.promptConsent);

  const code: string = await invoke(TAURI_COMMANDS.startOAuth, { authUrl: authUrl.toString() });
  return exchangeCodeForTokens(code, redirectUri);
};

export const exchangeCodeForTokens = async (code: string, redirectUri?: string): Promise<AuthState> => {
  const uri = redirectUri ?? (await invoke<string>(TAURI_COMMANDS.getOAuthRedirectUri));
  const res = await fetch(OAUTH_ENDPOINTS.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: uri,
      grant_type: OAUTH_PARAMS.grantTypeAuthCode,
    }).toString(),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const userRes = await fetch(OAUTH_ENDPOINTS.userInfo, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  if (!userRes.ok) throw new Error(`Failed to fetch user info: ${userRes.status}`);
  const user = await userRes.json() as { email: string };

  const auth: AuthState = {
    isAuthenticated: true,
    email: user.email,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  await setAuthState(auth);
  return auth;
};

export const refreshAccessToken = async (): Promise<AuthState> => {
  const auth = await getAuthState();
  if (!auth.refreshToken) throw new Error("No refresh token");

  const res = await fetch(OAUTH_ENDPOINTS.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: auth.refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: OAUTH_PARAMS.grantTypeRefresh,
    }).toString(),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);

  const data = await res.json() as { access_token: string; expires_in: number };

  const updated: AuthState = {
    ...auth,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  await setAuthState(updated);
  return updated;
};

export const getValidToken = async (): Promise<string> => {
  let auth = await getAuthState();
  if (!auth.isAuthenticated || !auth.accessToken) {
    throw new Error("Not authenticated");
  }

  if (auth.expiresAt && auth.expiresAt - Date.now() < TOKEN_EXPIRY_BUFFER_MS) {
    auth = await refreshAccessToken();
  }

  return auth.accessToken!;
};

export const logout = async (): Promise<void> => {
  await clearAuth();
};
