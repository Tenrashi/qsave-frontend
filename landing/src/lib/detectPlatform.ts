export type Platform = "windows" | "macos-arm" | "macos-intel" | "unknown";

type UADataBrands = { brands: Array<{ brand: string; version: string }> };
type UADataHighEntropy = { architecture?: string; platform?: string };
type NavigatorUAData = UADataBrands & {
  platform: string;
  getHighEntropyValues: (hints: string[]) => Promise<UADataHighEntropy>;
};

const getUAData = (): NavigatorUAData | undefined =>
  (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;

export const detectPlatform = async (): Promise<Platform> => {
  const uaData = getUAData();

  if (uaData?.platform === "Windows") return "windows";
  if (uaData?.platform === "macOS") {
    const hints = await uaData
      .getHighEntropyValues(["architecture"])
      .catch(() => undefined);
    if (hints?.architecture === "arm") return "macos-arm";
    if (hints?.architecture === "x86") return "macos-intel";
    return "macos-arm";
  }

  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macos-arm";
  return "unknown";
};

export const platformLabel: Record<Platform, string> = {
  windows: "Windows",
  "macos-arm": "macOS (Apple Silicon)",
  "macos-intel": "macOS (Intel)",
  unknown: "Your OS",
};
