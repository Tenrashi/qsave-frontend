# QSave

Desktop app that automatically backs up your video game save files to Google Drive.

QSave detects installed games using the [Ludusavi](https://github.com/mtkennerly/ludusavi) manifest, watches for save file changes in real time, and syncs them to your Google Drive with built-in versioning.

## Features

- **Auto-detection** — Scans your system for installed games and their save files using multiple game manifests
- **Real-time watching** — Monitors save directories for changes with debounced updates
- **Google Drive sync** — Upload saves with automatic versioning via Drive revisions
- **System tray** — Runs in the background, closing the window hides to tray
- **Notifications** — OS notifications when sync completes
- **Multi-language** — English, French, Spanish, German, Italian, Portuguese, Russian, Japanese, Chinese, Korean
- **Dark/Light mode** — Follows your system theme

## Tech Stack

- [Tauri 2](https://tauri.app/) — Desktop framework (Rust backend + web frontend)
- [React 19](https://react.dev/) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query) + [Zustand](https://zustand.docs.pmnd.rs/)
- [Rayon](https://docs.rs/rayon/) — Parallel disk scanning in Rust

## Getting Started

### Prerequisites

- [Node.js 24](https://nodejs.org/) (LTS)
- [pnpm 10](https://pnpm.io/)
- [Rust](https://rustup.rs/) (stable)
- [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/)

### Setup

```bash
cd qsave
pnpm install
cp .env.example .env
```

Edit `.env` with your Google Cloud OAuth credentials:

```
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your_client_secret
```

### Development

```bash
pnpm tauri dev
```

### Tests

```bash
pnpm test:run
```

### Build

```bash
pnpm tauri build
```

## Google Cloud Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google Drive API**
3. Create **OAuth 2.0 credentials** (Desktop app type)
4. Configure the consent screen
5. Copy the client ID and secret to your `.env` file

## Release

Push a version tag to trigger the CI build:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This creates a draft GitHub release with macOS (ARM + Intel) and Windows installers.

## Game Data

QSave uses the following manifests to detect games and their save file locations:

- [Ludusavi Manifest](https://github.com/mtkennerly/ludusavi-manifest) — primary game database, sourced from [PCGamingWiki](https://www.pcgamingwiki.com/)
- [Ludusavi Extra Manifests](https://github.com/BloodShed-Oni/ludusavi-extra-manifests) — community-contributed games missing from the primary manifest
- [Ludusavi Manifests (hvmzx)](https://github.com/hvmzx/ludusavi-manifests) — additional save paths for existing games

The primary manifest data comes from PCGamingWiki. If you find missing or incorrect save locations, please contribute back to the [wiki](https://www.pcgamingwiki.com/) so improvements benefit everyone.

## License

[AGPL-3.0](LICENSE)
