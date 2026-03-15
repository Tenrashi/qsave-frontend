import { open } from "@tauri-apps/plugin-shell";
import { fetch } from "@tauri-apps/plugin-http";
import type { AuthState } from "@/domain/types";
import { getAuthState, setAuthState, clearAuth } from "@/lib/store";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:8765/callback";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

export const startOAuthFlow = async (): Promise<AuthState> => {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  await open(authUrl.toString());

  return getAuthState();
};

export const exchangeCodeForTokens = async (code: string): Promise<AuthState> => {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
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

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: auth.refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
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

  if (auth.expiresAt && auth.expiresAt - Date.now() < 5 * 60 * 1000) {
    auth = await refreshAccessToken();
  }

  return auth.accessToken!;
};

export const logout = async (): Promise<void> => {
  await clearAuth();
};
