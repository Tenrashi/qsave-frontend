export const APP_NAME = "QSave" as const;

export const QUERY_KEYS = {
  games: ["games"],
  syncHistory: ["syncHistory"],
} as const;

export const STORE_KEYS = {
  auth: "auth",
  syncHistory: "syncHistory",
  driveFolders: "driveFolders",
  watchedGames: "watchedGames",
  syncFingerprints: "syncFingerprints",
  rootFolder: "__root__",
  manualGames: "manualGames",
} as const;

export const TAURI_COMMANDS = {
  getOAuthRedirectUri: "get_oauth_redirect_uri",
  startOAuth: "start_oauth",
  createZip: "create_zip",
  sendNativeNotification: "send_native_notification",
  scanGames: "scan_games",
  scanManualGame: "scan_manual_game",
  pickFolder: "pick_folder",
} as const;

export const OAUTH_ENDPOINTS = {
  auth: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  userInfo: "https://www.googleapis.com/oauth2/v2/userinfo",
} as const;

export const DRIVE_ENDPOINTS = {
  api: "https://www.googleapis.com/drive/v3",
  upload: "https://www.googleapis.com/upload/drive/v3",
} as const;

export const OAUTH_PARAMS = {
  grantTypeAuthCode: "authorization_code",
  grantTypeRefresh: "refresh_token",
  accessTypeOffline: "offline",
  promptConsent: "consent",
} as const;

export const MIME_TYPES = {
  googleFolder: "application/vnd.google-apps.folder",
  jsonUtf8: "application/json; charset=UTF-8",
  octetStream: "application/octet-stream",
} as const;

export const MAX_SAVES_PER_GAME = 5;
export const MAX_SYNC_HISTORY_RECORDS = 100;
export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
