#!/bin/bash
# Loads environment variables from the OS secret store for local development.
# Usage: source scripts/load-env.sh && pnpm tauri dev
#
# macOS: uses Keychain (security)
# Linux: uses libsecret (secret-tool) — install via: sudo apt install libsecret-tools

get_secret() {
  if command -v security &>/dev/null; then
    security find-generic-password -a "$USER" -s "$1" -w 2>/dev/null
  elif command -v secret-tool &>/dev/null; then
    secret-tool lookup service "$1" 2>/dev/null
  else
    echo ""
  fi
}

export VITE_GOOGLE_CLIENT_ID="$(get_secret qsave-google-client-id)"
export VITE_GOOGLE_CLIENT_SECRET="$(get_secret qsave-google-client-secret)"
export TAURI_SIGNING_PRIVATE_KEY="$(get_secret qsave-tauri-signing-key)"
export TAURI_SIGNING_PRIVATE_KEY_PATH="$(get_secret qsave-tauri-signing-key-path)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(get_secret qsave-tauri-signing-password)"

missing=()
[ -z "$VITE_GOOGLE_CLIENT_ID" ] && missing+=("VITE_GOOGLE_CLIENT_ID")
[ -z "$VITE_GOOGLE_CLIENT_SECRET" ] && missing+=("VITE_GOOGLE_CLIENT_SECRET")
[ -z "$TAURI_SIGNING_PRIVATE_KEY" ] && missing+=("TAURI_SIGNING_PRIVATE_KEY")
[ -z "$TAURI_SIGNING_PRIVATE_KEY_PATH" ] && missing+=("TAURI_SIGNING_PRIVATE_KEY_PATH")
[ -z "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" ] && missing+=("TAURI_SIGNING_PRIVATE_KEY_PASSWORD")

if [ ${#missing[@]} -gt 0 ]; then
  echo "ERROR: Missing secrets: ${missing[*]}"
  echo "See README.md for setup instructions."
  return 1 2>/dev/null || exit 1
fi

echo "All secrets loaded from OS secret store."
