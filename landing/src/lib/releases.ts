import type { Platform } from "./detectPlatform";

const REPO = "Tenrashi/qsave";
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
const CACHE_KEY = "qsave-latest-release";

type GitHubAsset = { name: string; browser_download_url: string };
type GitHubRelease = {
  tag_name: string;
  published_at: string;
  assets: GitHubAsset[];
};

export type PlatformDownload = {
  platform: Platform;
  url: string;
  filename: string;
};

export type ReleaseInfo = {
  version: string;
  publishedAt: string;
  downloads: PlatformDownload[];
  releasesPageUrl: string;
};

const matchAsset = (
  assets: GitHubAsset[],
  patterns: RegExp[],
): GitHubAsset | undefined => {
  for (const pattern of patterns) {
    const match = assets.find((asset) => pattern.test(asset.name));
    if (match) return match;
  }
  return undefined;
};

const buildDownloads = (assets: GitHubAsset[]): PlatformDownload[] => {
  const installers = assets.filter(
    (asset) => !asset.name.endsWith(".sig") && asset.name !== "latest.json",
  );

  const result: PlatformDownload[] = [];

  const windows = matchAsset(installers, [
    /_x64-setup\.exe$/,
    /_x64_en-US\.msi$/,
  ]);
  if (windows) {
    result.push({
      platform: "windows",
      url: windows.browser_download_url,
      filename: windows.name,
    });
  }

  const macArm = matchAsset(installers, [/_aarch64\.dmg$/]);
  if (macArm) {
    result.push({
      platform: "macos-arm",
      url: macArm.browser_download_url,
      filename: macArm.name,
    });
  }

  const macIntel = matchAsset(installers, [/_x64\.dmg$/]);
  if (macIntel) {
    result.push({
      platform: "macos-intel",
      url: macIntel.browser_download_url,
      filename: macIntel.name,
    });
  }

  return result;
};

const readCache = (): ReleaseInfo | undefined => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as ReleaseInfo;
  } catch {
    return undefined;
  }
};

const writeCache = (info: ReleaseInfo): void => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(info));
  } catch {
    // Ignore quota or privacy-mode errors — cache is best-effort.
  }
};

export const fetchLatestRelease = async (): Promise<ReleaseInfo> => {
  const cached = readCache();
  if (cached) return cached;

  const response = await fetch(RELEASES_API, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}`);
  }

  const release = (await response.json()) as GitHubRelease;
  const info: ReleaseInfo = {
    version: release.tag_name,
    publishedAt: release.published_at,
    downloads: buildDownloads(release.assets),
    releasesPageUrl: RELEASES_PAGE,
  };

  writeCache(info);
  return info;
};

export const releasesPageUrl = RELEASES_PAGE;
