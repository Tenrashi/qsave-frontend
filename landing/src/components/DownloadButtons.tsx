import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Apple, Download, Monitor } from "lucide-react";
import { cn } from "../lib/cn";
import { detectPlatform, type Platform } from "../lib/detectPlatform";
import {
  fetchLatestRelease,
  releasesPageUrl,
  type PlatformDownload,
  type ReleaseInfo,
} from "../lib/releases";

const platformIcon: Record<Platform, typeof Monitor> = {
  windows: Monitor,
  "macos-arm": Apple,
  "macos-intel": Apple,
  unknown: Download,
};

type ButtonProps = {
  download: PlatformDownload;
  primary: boolean;
};

const DownloadButton = ({ download, primary }: ButtonProps) => {
  const { t, i18n } = useTranslation();
  const Icon = platformIcon[download.platform];
  const platformName = t(`downloads.platform.${download.platform}`, {
    lng: i18n.resolvedLanguage,
  });

  return (
    <a
      href={download.url}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 text-base"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 text-sm",
      )}
    >
      <Icon className={primary ? "size-5" : "size-4"} aria-hidden />
      <span>{t("downloads.downloadFor", { platform: platformName })}</span>
    </a>
  );
};

export const DownloadButtons = () => {
  const { t, i18n } = useTranslation();
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [release, setRelease] = useState<ReleaseInfo | undefined>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    detectPlatform().then(setPlatform);
    fetchLatestRelease()
      .then(setRelease)
      .catch(() => setFailed(true));
  }, []);

  if (failed || (release && release.downloads.length === 0)) {
    return (
      <div className="flex flex-col items-center gap-3">
        <a
          href={releasesPageUrl}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 text-base font-medium"
        >
          <Download className="size-5" aria-hidden />
          <span>{t("downloads.downloadFromGitHub")}</span>
        </a>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const primary =
    release.downloads.find((download) => download.platform === platform) ??
    release.downloads[0];
  const others = release.downloads.filter((download) => download !== primary);
  const formattedDate = new Date(release.publishedAt).toLocaleDateString(
    i18n.resolvedLanguage,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <DownloadButton download={primary} primary />
      {others.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {others.map((download) => (
            <DownloadButton
              key={download.platform}
              download={download}
              primary={false}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t("downloads.versionLine", {
          version: release.version,
          date: formattedDate,
        })}{" "}
        ·{" "}
        <a href={releasesPageUrl} className="underline hover:text-foreground">
          {t("downloads.viewAllReleases")}
        </a>
      </p>
    </div>
  );
};
